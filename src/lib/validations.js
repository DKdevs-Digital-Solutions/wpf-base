import { apiGet, envUrl } from './http.js';

function digits(value = '') {
  return String(value || '').replace(/\D+/g, '');
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
  let phone = digits(value);

  // Remove o DDI do Brasil quando o número vier como 55 + DDD + número.
  // Exemplos tratados:
  // 5511999999999 -> 11999999999
  // 553199999999 -> 3199999999
  if ((phone.length === 12 || phone.length === 13) && phone.startsWith('55')) {
    phone = phone.slice(2);
  }

  // Mantém apenas o trecho final quando o canal enviar identificadores com
  // prefixos extras, preservando o telefone brasileiro local (DDD + número).
  if (phone.length > 11) {
    phone = phone.slice(-11);
  }

  return phone;
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
  return String(value || '').trim().slice(0, maxLength);
}

export async function lookupAddressByCep(cep) {
  const cleanCep = normalizeCep(cep);
  const baseUrl = envUrl('CEP_API_URL');

  if (baseUrl) {
    const data = await apiGet(`${baseUrl}/${cleanCep}`, { authenticated: false });
    return {
      cep: cleanCep,
      street: data.logradouro || data.street || '',
      neighborhood: data.bairro || data.neighborhood || '',
      city: data.localidade || data.city || '',
      state: data.uf || data.state || '',
      ibge: data.ibge || data.city_code || ''
    };
  }

  const data = await apiGet(`https://viacep.com.br/ws/${cleanCep}/json/`, { authenticated: false });
  if (data.erro) return null;

  return {
    cep: cleanCep,
    street: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
    ibge: data.ibge || ''
  };
}

async function getOptional(executor, fallbackValue) {
  try {
    return await executor();
  } catch {
    return fallbackValue;
  }
}


function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function normalizeCadastroUnicoPayload(data = {}) {
  const ticket = data.ticket || {};
  const customer = ticket.customer || data.customer || {};
  const customerAddress = customer.address || {};
  const cadUnico = customer.cadUnico || data.cadUnico || {};
  const contacts = Array.isArray(customer.contacts) ? customer.contacts : [];
  const primaryContact = contacts.find((contact) => String(contact?.type || '').toUpperCase() === 'PHONE') || contacts[0] || {};

  return {
    result: typeof data.result === 'boolean' ? data.result : undefined,
    eligible: typeof data.result === 'boolean' ? data.result : data.eligible,
    nome: firstValue(data.name, customer.name, cadUnico.name),
    name: firstValue(data.name, customer.name, cadUnico.name),
    protocol: firstValue(data.protocol, ticket.protocol),
    protocolo: firstValue(data.protocol, ticket.protocol),
    familyCode: firstValue(cadUnico.familyCode, data.familyCode, data.family_code),
    family_code: firstValue(cadUnico.familyCode, data.familyCode, data.family_code),
    nis: firstValue(customer.nis, cadUnico.nis, data.nis),
    cep: firstValue(customerAddress.postalCode, cadUnico.postalCode, data.cep),
    postalCode: firstValue(customerAddress.postalCode, cadUnico.postalCode, data.cep),
    logradouro: firstValue(customerAddress.streetName, customerAddress.street, cadUnico.publicPlace, data.logradouro),
    street: firstValue(customerAddress.streetName, customerAddress.street, cadUnico.publicPlace, data.street),
    bairro: firstValue(customerAddress.neighborhood, data.bairro),
    neighborhood: firstValue(customerAddress.neighborhood, data.neighborhood),
    cidade: firstValue(customerAddress.city, cadUnico.city, data.cidade),
    city: firstValue(customerAddress.city, cadUnico.city, data.city),
    uf: firstValue(customerAddress.state, cadUnico.state, data.uf),
    state: firstValue(customerAddress.state, cadUnico.state, data.state),
    ibge: firstValue(cadUnico.ibgeCode, data.ibge),
    telefone_principal: firstValue(primaryContact.value, customer.phone, data.telefone_principal),
    telefone: firstValue(primaryContact.value, customer.phone, data.telefone),
    numero: firstValue(customerAddress.number, data.numero),
    complemento: firstValue(customerAddress.complement, cadUnico.complement, data.complemento),
    ponto_referencia: firstValue(customerAddress.reference, data.ponto_referencia),
    message: firstValue(data.message)
  };
}

function boolFromResponse(data, keys = [], fallback = true) {
  for (const key of keys) {
    if (typeof data?.[key] === 'boolean') return data[key];
  }
  return fallback;
}

export async function validateCpfEligibility(cpf, protocolo = '') {
  const cleanCpf = normalizeCpf(cpf);
  const familyVerificationUrl = envUrl('FAMILY_CODE_VERIFICATION_API_URL', crmUrl('family-code-verification'));
  const cadastroUnicoUrl = envUrl('CADASTRO_UNICO_API_URL', crmUrl('cadastro-unico-verification'));
  const extraPhaseFamilyUrl = envUrl('EXTRA_PHASE_FAMILY_API_URL', crmUrl('fase-extra'));

  const cadastroUnico = normalizeCadastroUnicoPayload(await getOptional(async () => {
    if (!cadastroUnicoUrl) {
      return { eligible: true, nome: '', familyCode: '', hasInstallation: false, hasScheduleForCpf: false };
    }

    return apiGet(cadastroUnicoUrl, {
      params: {
        channel: process.env.CADUNICO_CHANNEL || 'WHATSAPP',
        classification: process.env.CADUNICO_CLASSIFICATION || 'AGENDAMENTO',
        document: cleanCpf,
        documentType: 'CPF',
        whoContacted: process.env.CADUNICO_WHO_CONTACTED || 'titular'
      }
    });
  }, { eligible: true, nome: '', familyCode: '', hasInstallation: false, hasScheduleForCpf: false }));

  const familyCode = String(
    cadastroUnico.familyCode ||
    cadastroUnico.family_code ||
    cadastroUnico.codigoFamilia ||
    cadastroUnico.familyCodeNumber ||
    ''
  );

  const familyVerification = await getOptional(async () => {
    if (!familyVerificationUrl || !cleanCpf) {
      return {
        exists: true,
        hasInstallation: false,
        hasScheduleForCpf: false,
        hasScheduleForFamilyCode: false,
        protocolo: ''
      };
    }

    return apiGet(familyVerificationUrl, {
      params: {
        document: cleanCpf,
        documentType: 'CPF',
        protocol: protocolo
      }
    });
  }, {
    exists: true,
    hasInstallation: false,
    hasScheduleForCpf: false,
    hasScheduleForFamilyCode: false,
    protocolo: ''
  });

  const extraPhase = await getOptional(async () => {
    if (!extraPhaseFamilyUrl || !familyCode) return { eligible: true };

    return apiGet(extraPhaseFamilyUrl, {
      params: {
        familyCode,
        protocol: protocolo
      }
    });
  }, { eligible: true });

  return {
    eligible: boolFromResponse(cadastroUnico, ['eligible', 'exists', 'found'], true),
    nome: cadastroUnico.nome || cadastroUnico.name || cadastroUnico.customerName || '',
    familyCode,
    protocoloExistente: familyVerification.protocolo || familyVerification.protocol || cadastroUnico.protocolo || '',
    extraPhaseEligible: boolFromResponse(extraPhase, ['eligible', 'available', 'success'], true),
    hasInstallation: Boolean(familyVerification.hasInstallation || familyVerification.serviceOrderOpen || familyVerification.existsOpenOrder),
    hasScheduleForCpf: Boolean(familyVerification.hasScheduleForCpf || familyVerification.scheduleOpenForCpf),
    hasScheduleForFamilyCode: Boolean(familyVerification.hasScheduleForFamilyCode || familyVerification.scheduleOpenForFamilyCode)
  };
}

export async function validateCepEligibility(cep, protocolo = '') {
  const address = await lookupAddressByCep(cep);
  if (!address) {
    return { ok: false, code: 'cep_not_found', reason: 'CEP não encontrado' };
  }

  const cityAvailabilityUrl = envUrl('CITY_AVAILABILITY_API_URL', crmUrl('city-availability'));
  const extraPhaseIbgeUrl = envUrl('EXTRA_PHASE_IBGE_API_URL', crmUrl('extra-phases/ibge-availability'));

  const cityAvailability = await getOptional(async () => {
    if (!cityAvailabilityUrl || !address.ibge) {
      return { available: true, stage: 'vigente', reason: '' };
    }

    return apiGet(cityAvailabilityUrl, {
      params: {
        postalCode: address.ibge,
        protocol: protocolo,
        'extra-phase': true
      }
    });
  }, { available: true, stage: 'vigente', reason: '' });

  const extraPhase = await getOptional(async () => {
    if (!extraPhaseIbgeUrl || !address.ibge) return { eligible: true };

    return apiGet(extraPhaseIbgeUrl, {
      params: {
        ibge: address.ibge,
        protocol: protocolo
      }
    });
  }, { eligible: true });

  if (cityAvailability.available === false || cityAvailability.status === false) {
    return {
      ok: false,
      code: cityAvailability.code || 'city_unavailable',
      reason: cityAvailability.reason || 'Cidade não atendida',
      address
    };
  }

  if (extraPhase.eligible === false || extraPhase.available === false) {
    return {
      ok: false,
      code: extraPhase.code || 'no_extra_phase',
      reason: extraPhase.reason || 'Sem fase extra para este CEP',
      address
    };
  }

  return {
    ok: true,
    address,
    stage: cityAvailability.stage || cityAvailability.phase || 'vigente'
  };
}
