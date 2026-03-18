import { apiGet, envUrl, crmUrl } from './http.js';

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

  if ((phone.length === 12 || phone.length === 13) && phone.startsWith('55')) {
    phone = phone.slice(2);
  }

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

async function getOptional(executor, fallbackValue) {
  try {
    return await executor();
  } catch (error) {
    console.error('[VALIDATIONS] optional call failed:', error?.message || error);
    return fallbackValue;
  }
}

function boolFromResponse(data, keys = [], fallback = true) {
  for (const key of keys) {
    if (typeof data?.[key] === 'boolean') return data[key];
  }
  return fallback;
}

function firstPhoneContact(contacts = []) {
  if (!Array.isArray(contacts)) return '';
  const phoneContact = contacts.find((item) => String(item?.type || '').toUpperCase() === 'PHONE');
  return phoneContact?.value || '';
}

export async function validateCpfEligibility(cpf, protocolo = '', telefonePrincipal = '') {
  const cleanCpf = normalizeCpf(cpf);

  const familyVerificationUrl = envUrl(
    'FAMILY_CODE_VERIFICATION_API_URL',
    crmUrl('family-code-verification')
  );

  const cadastroUnicoUrl = envUrl(
    'CADASTRO_UNICO_API_URL',
    crmUrl('cadastro-unico-verification')
  );

  const extraPhaseFamilyUrl = envUrl(
    'EXTRA_PHASE_FAMILY_API_URL',
    crmUrl('fase-extra-family-code')
  );

  const cadastroUnico = await getOptional(async () => {
    if (!cadastroUnicoUrl) {
      return {
        result: false,
        protocol: protocolo,
        ticket: {
          customer: {
            cpf: cleanCpf,
            name: '',
            contacts: [],
            address: {},
            cadUnico: {}
          }
        }
      };
    }

    return apiGet(cadastroUnicoUrl, {
      params: {
        channel: process.env.CADUNICO_CHANNEL || 'WHATSAPP',
        classification: process.env.CADUNICO_CLASSIFICATION || 'AGENDAMENTO',
        document: cleanCpf,
        documentType: 'CPF'
      }
    });
  }, {
    result: false,
    protocol: protocolo,
    ticket: {
      customer: {
        cpf: cleanCpf,
        name: '',
        contacts: [],
        address: {},
        cadUnico: {}
      }
    }
  });

  console.log('[CPF] cadastro-unico raw response:', JSON.stringify(cadastroUnico, null, 2));

  const customer = cadastroUnico?.ticket?.customer ?? {};
  const address = customer?.address ?? {};
  const cadUnico = customer?.cadUnico ?? {};
  const contacts = Array.isArray(customer?.contacts) ? customer.contacts : [];

  console.log('[CPF] customer.address extraído:', JSON.stringify(address, null, 2));

  const familyCode = String(cadUnico?.familyCode || '').trim();

  const normalizedPhone = normalizePhone(
    telefonePrincipal ||
      firstPhoneContact(contacts) ||
      ''
  );

  const normalized = {
    protocolo: String(cadastroUnico?.protocol || protocolo || '').trim(),
    cpf: normalizeCpf(customer?.cpf || cleanCpf),
    nome: String(customer?.name || cadastroUnico?.name || '').trim(),
    familyCode,
    telefone_principal: normalizedPhone,
    cep: normalizeCep(address?.postalCode || ''),
    logradouro: String(address?.streetName || '').trim(),
    bairro: String(address?.neighborhood || '').trim(),
    cidade: String(address?.city || '').trim(),
    uf: String(address?.state || '').trim().toUpperCase(),
    complemento: address?.complement == null ? '' : String(address.complement).trim(),
    ibge: String(cadUnico?.ibgeCode || '').trim()
  };

  console.log('[CPF] normalized address data:', JSON.stringify(normalized, null, 2));

  const familyVerification = await getOptional(async () => {
    if (!familyVerificationUrl || !cleanCpf) {
      return {
        exists: true,
        hasInstallation: false,
        hasScheduleForCpf: false,
        hasScheduleForFamilyCode: false,
        protocolo: normalized.protocolo
      };
    }

    return apiGet(familyVerificationUrl, {
      params: {
        document: cleanCpf,
        documentType: 'CPF',
        protocol: normalized.protocolo || protocolo
      }
    });
  }, {
    exists: true,
    hasInstallation: false,
    hasScheduleForCpf: false,
    hasScheduleForFamilyCode: false,
    protocolo: normalized.protocolo
  });

  const extraPhase = await getOptional(async () => {
    if (!extraPhaseFamilyUrl || !familyCode) return { eligible: true };

    return apiGet(extraPhaseFamilyUrl, {
      params: {
        familyCode,
        protocol: normalized.protocolo || protocolo
      }
    });
  }, { eligible: true });

  const result = {
    eligible: boolFromResponse(cadastroUnico, ['result', 'eligible', 'exists', 'found'], false),
    nome: normalized.nome,
    familyCode: normalized.familyCode,
    protocoloExistente:
      familyVerification?.protocolo ||
      familyVerification?.protocol ||
      normalized.protocolo ||
      '',
    extraPhaseEligible: boolFromResponse(extraPhase, ['eligible', 'available', 'success'], true),
    hasInstallation: Boolean(
      familyVerification?.hasInstallation ||
        familyVerification?.serviceOrderOpen ||
        familyVerification?.existsOpenOrder
    ),
    hasScheduleForCpf: Boolean(
      familyVerification?.hasScheduleForCpf || familyVerification?.scheduleOpenForCpf
    ),
    hasScheduleForFamilyCode: Boolean(
      familyVerification?.hasScheduleForFamilyCode ||
        familyVerification?.scheduleOpenForFamilyCode
    ),
    protocolo: normalized.protocolo,
    cpf: normalized.cpf,
    telefone_principal: normalized.telefone_principal,
    cep: normalized.cep,
    logradouro: normalized.logradouro,
    bairro: normalized.bairro,
    cidade: normalized.cidade,
    uf: normalized.uf,
    complemento: normalized.complemento,
    ibge: normalized.ibge
  };

  console.log('[CPF] result:', JSON.stringify({
    eligible: result.eligible,
    protocolo: result.protocolo,
    cpf: result.cpf,
    nome: result.nome,
    familyCode: result.familyCode,
    cep: result.cep,
    logradouro: result.logradouro,
    bairro: result.bairro,
    cidade: result.cidade,
    uf: result.uf,
    complemento: result.complemento,
    hasBaseAddress: Boolean(result.cep && result.cidade && result.uf),
    hasLogradouro: Boolean(result.logradouro),
    hasBairro: Boolean(result.bairro),
    hasComplemento: String(result.complemento || '').trim() !== ''
  }, null, 2));

  return result;
}

export async function validateCepEligibility(cep, protocolo = '') {
  const cleanCep = normalizeCep(cep);

  console.log('[CEP] validação manual do CEP recebida:', JSON.stringify({
    cepOriginal: cep,
    cepNormalizado: cleanCep,
    protocolo
  }, null, 2));

  if (!cleanCep || cleanCep.length !== 8) {
    return { ok: false, code: 'cep_invalido', reason: 'CEP inválido. Informe os 8 números do CEP.' };
  }

  return {
    ok: true,
    address: {
      cep: cleanCep,
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      ibge: '',
      complement: ''
    },
    stage: 'manual'
  };
}