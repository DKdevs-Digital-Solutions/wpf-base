import axios from "axios";

function digits(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

export function normalizeCpf(value) {
  return digits(value).slice(0, 11);
}

export function isValidCPF(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

export function normalizePhone(value) {
  return digits(value).slice(0, 11);
}

export function isValidPhone(value) {
  const phone = normalizePhone(value);
  return phone.length >= 10 && phone.length <= 11;
}

export function normalizeCep(value) {
  return digits(value).slice(0, 8);
}

export function isValidCepFormat(value) {
  return normalizeCep(value).length === 8;
}

export function requiredText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

async function safeGet(url, config = {}) {
  const response = await axios.get(url, { timeout: 15000, ...config });
  return response.data;
}

function envUrl(name) {
  const value = process.env[name];
  return value ? value.replace(/\/+$/g, "") : "";
}

export async function lookupAddressByCep(cep) {
  const cleanCep = normalizeCep(cep);
  const baseUrl = envUrl("CEP_API_URL");

  if (baseUrl) {
    const data = await safeGet(`${baseUrl}/${cleanCep}`);
    return {
      cep: cleanCep,
      street: data.logradouro || data.street || "",
      neighborhood: data.bairro || data.neighborhood || "",
      city: data.localidade || data.city || "",
      state: data.uf || data.state || "",
      ibge: data.ibge || data.city_code || ""
    };
  }

  const data = await safeGet(`https://viacep.com.br/ws/${cleanCep}/json/`);
  if (data.erro) {
    return null;
  }

  return {
    cep: cleanCep,
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: data.uf || "",
    ibge: data.ibge || ""
  };
}

async function getOptional(url, fallbackValue) {
  if (!url) return fallbackValue;
  try {
    return await safeGet(url);
  } catch {
    return fallbackValue;
  }
}

export async function validateCpfEligibility(cpf) {
  const cleanCpf = normalizeCpf(cpf);
  const baseUrl = envUrl("ELIGIBILITY_API_URL");
  const extraPhaseUrl = envUrl("EXTRA_PHASE_FAMILY_API_URL");
  const familyVerificationUrl = envUrl("FAMILY_CODE_VERIFICATION_API_URL");

  const eligibility = await getOptional(baseUrl ? `${baseUrl}/${cleanCpf}` : "", {
    eligible: true,
    nome: "",
    familyCode: "",
    hasInstallation: false,
    hasScheduleForCpf: false,
    hasScheduleForFamilyCode: false
  });

  const familyCode = eligibility.familyCode || eligibility.family_code || "";

  const extraPhase = await getOptional(
    extraPhaseUrl && familyCode ? `${extraPhaseUrl}/${familyCode}` : "",
    { eligible: true }
  );

  const familyVerification = await getOptional(
    familyVerificationUrl && familyCode ? `${familyVerificationUrl}/${familyCode}` : "",
    {
      hasInstallation: eligibility.hasInstallation || false,
      hasScheduleForCpf: eligibility.hasScheduleForCpf || false,
      hasScheduleForFamilyCode: eligibility.hasScheduleForFamilyCode || false,
      protocolo: eligibility.protocolo || ""
    }
  );

  return {
    eligible: eligibility.eligible !== false,
    nome: eligibility.nome || eligibility.name || "",
    familyCode,
    protocoloExistente: familyVerification.protocolo || eligibility.protocolo || "",
    extraPhaseEligible: extraPhase.eligible !== false,
    hasInstallation: Boolean(familyVerification.hasInstallation),
    hasScheduleForCpf: Boolean(familyVerification.hasScheduleForCpf),
    hasScheduleForFamilyCode: Boolean(familyVerification.hasScheduleForFamilyCode)
  };
}

export async function validateCepEligibility(cep) {
  const address = await lookupAddressByCep(cep);
  if (!address) {
    return {
      ok: false,
      code: "cep_not_found",
      reason: "CEP não encontrado"
    };
  }

  const cityAvailabilityUrl = envUrl("CITY_AVAILABILITY_API_URL");
  const extraPhaseIbgeUrl = envUrl("EXTRA_PHASE_IBGE_API_URL");

  const cityAvailability = await getOptional(
    cityAvailabilityUrl && address.ibge ? `${cityAvailabilityUrl}/${address.ibge}` : "",
    { available: true, stage: "vigente", reason: "" }
  );

  const extraPhase = await getOptional(
    extraPhaseIbgeUrl && address.ibge ? `${extraPhaseIbgeUrl}/${address.ibge}` : "",
    { eligible: true }
  );

  if (cityAvailability.available === false) {
    return {
      ok: false,
      code: cityAvailability.code || "city_unavailable",
      reason: cityAvailability.reason || "Cidade não atendida",
      address
    };
  }

  if (extraPhase.eligible === false) {
    return {
      ok: false,
      code: extraPhase.code || "no_extra_phase",
      reason: extraPhase.reason || "Sem fase extra para este CEP",
      address
    };
  }

  return {
    ok: true,
    address,
    stage: cityAvailability.stage || "vigente"
  };
}
