import crypto from 'crypto';
import {
  isValidCepFormat,
  isValidPhone,
  normalizeCep,
  normalizeCpf,
  normalizePhone,
  requiredText,
  validateCepEligibility
} from '../lib/validations.js';

function protocolFromData(data = {}) {
  return String(data.protocolo || data.protocol || data.protocolNumber || '').trim();
}

function screenResponse(screen, data = {}) {
  return { screen, data };
}

function finishResponse({
  protocolo,
  status = 'failure',
  code = 'flow_finished',
  reason = '',
  finishMessage = '',
  jobId = '',
  extra = {}
}) {
  return screenResponse('FINISH', {
    protocolo,
    status,
    reason_code: code,
    reason,
    job_id: jobId,
    finish_message:
      finishMessage ||
      reason ||
      'Para que suas informações sejam processadas, é necessário tocar em Concluir.',
    ...extra
  });
}

export function failureResponse({ protocolo, code, reason, finishMessage = '', extra = {} }) {
  return finishResponse({
    protocolo,
    status: 'failure',
    code,
    reason,
    finishMessage: finishMessage || reason,
    extra
  });
}

export function queuedResponse({ protocolo, jobId, extra = {} }) {
  return finishResponse({
    protocolo,
    status: 'queued',
    code: 'queued_for_processing',
    reason: 'Dados confirmados e imagens enviadas para processamento.',
    finishMessage:
      'Dados confirmados. Toque em Concluir para finalizar o flow.',
    jobId: String(jobId || ''),
    extra
  });
}

const SCREEN_FIELDS = {
  CPF_INPUT: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge','numero','ponto_referencia','resumo_texto','finish_message','status','reason_code','reason','job_id','tipo_documento','doc_frente','doc_verso','selfie_com_doc','comprovante_residencia','fachada','tv_ligada'],
  CONTATOS: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge'],
  CONFIRMA_ENDERECO_ONE: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge'],
  COMPLEMENTAR_ENDERECO_CADASTRAL: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge','numero','ponto_referencia'],
  ESCOLHER_CAMPO_ENDERECO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge','numero','ponto_referencia'],
  EDITAR_CAMPO_ENDERECO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge','numero','ponto_referencia','campo_endereco'],
  CONFIRMA_ENDERECO_AJUSTADO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge','numero','ponto_referencia'],
  CEP_REINPUT: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge','numero','ponto_referencia'],
  CONFIRMA_ENDERECO_TWO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge'],
  ENDERECO_COMPLETO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','bairro','cidade','uf','complemento','ibge'],
  TIPO_DOCUMENTO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge'],
  DOC_FRENTE: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento'],
  DOC_VERSO: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente'],
  SELFIE_COM_DOC: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente','doc_verso'],
  COMPROVANTE: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente','doc_verso','selfie_com_doc'],
  FACHADA: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente','doc_verso','selfie_com_doc','comprovante_residencia'],
  TV_LIGADA: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente','doc_verso','selfie_com_doc','comprovante_residencia','fachada'],
  RESUMO_FINAL: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente','doc_verso','selfie_com_doc','comprovante_residencia','fachada','tv_ligada','resumo_texto'],
  CONFIRMACAO_FINAL: ['protocolo','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','doc_frente','doc_verso','selfie_com_doc','comprovante_residencia','fachada','tv_ligada'],
  FINISH: ['status','reason_code','reason','protocolo','job_id','cpf','nome','family_code','telefone_principal','telefone_recado','nome_contato_recado','cep','logradouro','numero','bairro','cidade','uf','complemento','ponto_referencia','ibge','tipo_documento','finish_message','doc_frente','doc_verso','selfie_com_doc','comprovante_residencia','fachada','tv_ligada']
};

function projectDataForScreen(screen, data = {}) {
  const fields = SCREEN_FIELDS[screen] || Object.keys(data || {});
  return Object.fromEntries(fields.filter((field) => data[field] !== undefined).map((field) => [field, data[field]]));
}

function successNext(screen, data = {}, extra = {}) {
  return screenResponse(screen, projectDataForScreen(screen, { ...data, ...extra }));
}

function normalizeMediaValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return '';
  return String(value);
}

function normalizeCommonState(data = {}) {
  return {
    protocolo: protocolFromData(data),
    cpf: normalizeCpf(data.cpf),
    nome: String(data.nome || ''),
    family_code: String(data.family_code || data.familyCode || ''),
    telefone_principal: normalizePhone(data.telefone_principal || data.telefone || data.phone),
    telefone_recado: normalizePhone(data.telefone_recado),
    nome_contato_recado: String(data.nome_contato_recado || ''),
    cep: normalizeCep(data.cep),
    logradouro: String(data.logradouro || data.street || ''),
    numero: String(data.numero || ''),
    bairro: String(data.bairro || data.neighborhood || ''),
    complemento: data.complemento == null ? '' : String(data.complemento),
    cidade: String(data.cidade || data.city || ''),
    uf: String(data.uf || data.estado || data.state || '').toUpperCase(),
    ibge: String(data.ibge || ''),
    ponto_referencia: String(data.ponto_referencia || ''),
    campo_endereco: String(data.campo_endereco || '').toLowerCase(),
    valor_campo_endereco: String(data.valor_campo_endereco || ''),
    tipo_documento: String(data.tipo_documento || '').toUpperCase(),
    resumo_texto: String(data.resumo_texto || ''),
    doc_frente: normalizeMediaValue(data.doc_frente || data.foto_frente),
    doc_verso: normalizeMediaValue(data.doc_verso || data.foto_verso),
    selfie_com_doc: normalizeMediaValue(data.selfie_com_doc),
    comprovante_residencia: normalizeMediaValue(data.comprovante_residencia || data.comprovante),
    fachada: normalizeMediaValue(data.fachada),
    tv_ligada: normalizeMediaValue(data.tv_ligada)
  };
}

function hasBaseAddress(state) {
  return Boolean(
    state.cep &&
      String(state.cep).trim() &&
      state.cidade &&
      String(state.cidade).trim() &&
      state.uf &&
      String(state.uf).trim()
  );
}

function missingAddressDetails(state) {
  return {
    logradouro: !state.logradouro || !String(state.logradouro).trim(),
    bairro: !state.bairro || !String(state.bairro).trim(),
    complemento: state.complemento == null || String(state.complemento).trim() === ''
  };
}

function needsAddressComplement(state) {
  const missing = missingAddressDetails(state);
  return missing.logradouro || missing.bairro || missing.complemento;
}

function replaceAddressField(state, field, value) {
  const nextValue = requiredText(value, 120);
  if (!nextValue) return null;

  switch (field) {
    case 'logradouro':
      return { ...state, logradouro: nextValue };
    case 'bairro':
      return { ...state, bairro: nextValue };
    case 'complemento':
      return { ...state, complemento: nextValue };
    default:
      return null;
  }
}

function buildFinalPayload(state) {
  return {
    protocolo: String(state.protocolo || ''),
    cpf: String(state.cpf || ''),
    nome: String(state.nome || ''),
    family_code: String(state.family_code || ''),
    telefone_principal: String(state.telefone_principal || ''),
    telefone_recado: String(state.telefone_recado || ''),
    nome_contato_recado: String(state.nome_contato_recado || ''),
    cep: String(state.cep || ''),
    logradouro: String(state.logradouro || ''),
    numero: String(state.numero || ''),
    bairro: String(state.bairro || ''),
    cidade: String(state.cidade || ''),
    uf: String(state.uf || ''),
    complemento: String(state.complemento || ''),
    ponto_referencia: String(state.ponto_referencia || ''),
    ibge: String(state.ibge || ''),
    tipo_documento: String(state.tipo_documento || ''),
    doc_frente: state.doc_frente,
    doc_verso: state.doc_verso,
    selfie_com_doc: state.selfie_com_doc,
    comprovante_residencia: state.comprovante_residencia,
    fachada: state.fachada,
    tv_ligada: state.tv_ligada
  };
}

function buildResumoTexto(state) {
  const missing = missingAddressDetails(state);
  return [
    `Protocolo: ${state.protocolo || '-'}`,
    `CPF: ${state.cpf || '-'}`,
    `Nome: ${state.nome || '-'}`,
    `Telefone principal: ${state.telefone_principal || '-'}`,
    '',
    'Endereço:',
    `CEP: ${state.cep || '-'}`,
    `Logradouro: ${state.logradouro || '-'}`,
    `Número: ${state.numero || '-'}`,
    `Bairro: ${state.bairro || '-'}`,
    `Cidade: ${state.cidade || '-'}`,
    `UF: ${state.uf || '-'}`,
    `Complemento: ${state.complemento || '-'}`,
    `Ponto de referência: ${state.ponto_referencia || '-'}`,
    '',
    'Revisão do endereço:',
    `Logradouro pendente: ${missing.logradouro ? 'Sim' : 'Não'}`,
    `Bairro pendente: ${missing.bairro ? 'Sim' : 'Não'}`,
    `Complemento pendente: ${missing.complemento ? 'Sim' : 'Não'}`,
    '',
    `Tipo de documento: ${state.tipo_documento || '-'}`,
    `Documento frente: ${state.doc_frente?.length ? 'OK' : 'Não enviado'}`,
    `Documento verso: ${state.tipo_documento === 'CNH' ? 'Não aplicável' : (state.doc_verso?.length ? 'OK' : 'Não enviado')}`,
    `Selfie com documento: ${state.selfie_com_doc?.length ? 'OK' : 'Não enviado'}`,
    `Comprovante de residência: ${state.comprovante_residencia?.length ? 'OK' : 'Não enviado'}`,
    `Fachada: ${state.fachada?.length ? 'OK' : 'Não enviado'}`,
    `TV ligada: ${state.tv_ligada?.length ? 'OK' : 'Não enviado'}`
  ].join('\n');
}

export async function handleFlowStep({ screen, data, enqueueJob }) {
  const state = normalizeCommonState(data);

  switch (screen) {
    case 'INIT':
      return screenResponse('CPF_INPUT', {
        protocolo: String(state.protocolo || ''),
        cpf: String(state.cpf || ''),
        nome: String(state.nome || ''),
        family_code: String(state.family_code || ''),
        telefone_principal: String(state.telefone_principal || ''),
        telefone_recado: String(state.telefone_recado || ''),
        nome_contato_recado: String(state.nome_contato_recado || ''),
        cep: String(state.cep || ''),
        logradouro: String(state.logradouro || ''),
        bairro: String(state.bairro || ''),
        cidade: String(state.cidade || ''),
        uf: String(state.uf || ''),
        complemento: String(state.complemento || ''),
        ibge: String(state.ibge || ''),
        numero: String(state.numero || ''),
        ponto_referencia: String(state.ponto_referencia || ''),
        resumo_texto: String(state.resumo_texto || ''),
        finish_message: String(data?.finish_message || ''),
        status: String(data?.status || ''),
        reason_code: String(data?.reason_code || ''),
        reason: String(data?.reason || ''),
        job_id: String(data?.job_id || ''),
        tipo_documento: String(data?.tipo_documento || ''),
        doc_frente: typeof state.doc_frente === 'string' ? state.doc_frente : '',
        doc_verso: typeof state.doc_verso === 'string' ? state.doc_verso : '',
        selfie_com_doc: typeof state.selfie_com_doc === 'string' ? state.selfie_com_doc : '',
        comprovante_residencia: typeof state.comprovante_residencia === 'string' ? state.comprovante_residencia : '',
        fachada: typeof state.fachada === 'string' ? state.fachada : '',
        tv_ligada: typeof state.tv_ligada === 'string' ? state.tv_ligada : ''
      });

    case 'CPF_INPUT': {
      const nextState = {
        ...state,
        protocolo: String(state.protocolo || '').trim(),
        nome: String(state.nome || '').trim(),
        family_code: String(state.family_code || '').trim(),
        telefone_principal: normalizePhone(state.telefone_principal),
        cep: normalizeCep(state.cep),
        logradouro: String(state.logradouro || '').trim(),
        bairro: String(state.bairro || '').trim(),
        cidade: String(state.cidade || '').trim(),
        uf: String(state.uf || '').trim().toUpperCase(),
        complemento: state.complemento == null ? '' : String(state.complemento).trim(),
        ibge: String(state.ibge || '').trim()
      };

      if (!nextState.cpf) {
        return failureResponse({
          protocolo: nextState.protocolo,
          code: 'cpf_nao_informado',
          reason: 'CPF não informado para iniciar o fluxo.'
        });
      }


      const addressExists = hasBaseAddress(nextState);
      return successNext(addressExists ? 'CONFIRMA_ENDERECO_ONE' : 'CEP_REINPUT', nextState);
    }

    case 'CONFIRMA_ENDERECO_ONE': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();

      if (decisao === 'confirmar') {
        const nextScreen = needsAddressComplement(state)
          ? 'COMPLEMENTAR_ENDERECO_CADASTRAL'
          : 'ENDERECO_COMPLETO';
        return successNext(nextScreen, state);
      }

      if (decisao === 'corrigir') {
        return successNext('ESCOLHER_CAMPO_ENDERECO', state);
      }

      return failureResponse({
        protocolo: state.protocolo,
        code: 'confirmacao_endereco_invalida',
        reason: 'Escolha uma opção para continuar.'
      });
    }

    case 'COMPLEMENTAR_ENDERECO_CADASTRAL': {
      const logradouro = requiredText(data.logradouro || state.logradouro, 120);
      const bairro = requiredText(data.bairro || state.bairro, 120);
      const complemento = requiredText(data.complemento || state.complemento, 120);

      if (!logradouro) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'logradouro_obrigatorio',
          reason: 'Logradouro é obrigatório.'
        });
      }

      if (!bairro) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'bairro_obrigatorio',
          reason: 'Bairro é obrigatório.'
        });
      }

      if (!complemento) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'complemento_obrigatorio',
          reason: 'Complemento é obrigatório.'
        });
      }

      return successNext('ENDERECO_COMPLETO', {
        ...state,
        logradouro,
        bairro,
        complemento
      });
    }

    case 'ESCOLHER_CAMPO_ENDERECO': {
      const campo = String(data.campo_endereco || '').toLowerCase();
      const camposPermitidos = ['cep', 'logradouro', 'bairro', 'complemento'];

      if (!camposPermitidos.includes(campo)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'campo_endereco_invalido',
          reason: 'Selecione CEP, logradouro, bairro ou complemento.'
        });
      }

      if (campo === 'cep') {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'open_new_flow_for_cep',
          reason: 'CEP precisa ser ajustado em outro flow.'
        });
      }

      return successNext('EDITAR_CAMPO_ENDERECO', { ...state, campo_endereco: campo });
    }

    case 'EDITAR_CAMPO_ENDERECO': {
      const campo = state.campo_endereco;
      const valor = requiredText(data.valor_campo_endereco, 120);

      if (!campo || !['logradouro', 'bairro', 'complemento'].includes(campo)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'campo_endereco_invalido',
          reason: 'Campo do endereço inválido para edição.'
        });
      }

      if (!valor) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'valor_campo_endereco_obrigatorio',
          reason: 'Informe o novo valor do campo selecionado.'
        });
      }

      const updated = replaceAddressField(state, campo, valor);
      if (!updated) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'falha_edicao_endereco',
          reason: 'Não foi possível atualizar o campo do endereço.'
        });
      }

      return successNext('CONFIRMA_ENDERECO_AJUSTADO', updated);
    }

    case 'CONFIRMA_ENDERECO_AJUSTADO': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();

      if (decisao === 'confirmar') {
        const nextScreen = needsAddressComplement(state)
          ? 'COMPLEMENTAR_ENDERECO_CADASTRAL'
          : 'ENDERECO_COMPLETO';
        return successNext(nextScreen, state);
      }

      if (decisao === 'corrigir') {
        return successNext('ESCOLHER_CAMPO_ENDERECO', state);
      }

      if (decisao === 'encerrar') {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ajuste_endereco_externo',
          reason: 'Endereço precisa de ajuste externo.'
        });
      }

      return failureResponse({
        protocolo: state.protocolo,
        code: 'confirmacao_endereco_invalida',
        reason: 'Escolha uma opção para continuar.'
      });
    }

    case 'CEP_REINPUT': {
      if (!isValidCepFormat(state.cep)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'cep_invalido',
          reason: 'CEP inválido. Informe os 8 números do CEP.'
        });
      }

      const cepValidation = await validateCepEligibility(state.cep, state.protocolo);

      if (!cepValidation.ok) {
        return failureResponse({
          protocolo: state.protocolo,
          code: cepValidation.code,
          reason: cepValidation.reason
        });
      }

      return successNext('CONFIRMA_ENDERECO_TWO', {
        ...state,
        cep: normalizeCep(cepValidation.address?.cep || state.cep),
        logradouro: String(cepValidation.address?.logradouro || state.logradouro || '').trim(),
        bairro: String(cepValidation.address?.bairro || state.bairro || '').trim(),
        cidade: String(cepValidation.address?.cidade || state.cidade || '').trim(),
        uf: String(cepValidation.address?.uf || state.uf || '').trim().toUpperCase(),
        complemento:
          cepValidation.address?.complemento == null
            ? String(state.complemento || '')
            : String(cepValidation.address.complemento).trim(),
        ibge: String(cepValidation.address?.ibge || state.ibge || '').trim()
      });
    }

    case 'CONFIRMA_ENDERECO_TWO': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();

      if (decisao === 'confirmar') {
        const nextScreen = needsAddressComplement(state)
          ? 'COMPLEMENTAR_ENDERECO_CADASTRAL'
          : 'ENDERECO_COMPLETO';
        return successNext(nextScreen, state);
      }

      if (decisao === 'corrigir') {
        return successNext('ESCOLHER_CAMPO_ENDERECO', state);
      }

      if (decisao === 'encerrar') {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ajuste_endereco_externo',
          reason: 'Endereço precisa de ajuste externo.'
        });
      }

      return failureResponse({
        protocolo: state.protocolo,
        code: 'confirmacao_endereco_invalida',
        reason: 'Escolha uma opção para continuar.'
      });
    }

    case 'ENDERECO_COMPLETO': {
      const numero = requiredText(data.numero || state.numero, 20);
      const pontoReferencia = requiredText(data.ponto_referencia || state.ponto_referencia, 180);

      if (!numero) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'numero_obrigatorio',
          reason: 'Número da residência é obrigatório.'
        });
      }

      if (!pontoReferencia) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ponto_referencia_obrigatorio',
          reason: 'Ponto de referência é obrigatório.'
        });
      }

      return successNext('CONTATOS', {
        ...state,
        numero,
        ponto_referencia: pontoReferencia
      });
    }

    case 'CONTATOS': {
      const telefonePrincipal = normalizePhone(data.telefone_principal || state.telefone_principal);
      const telefoneRecado = normalizePhone(data.telefone_recado || state.telefone_recado);
      const nomeContatoRecado = requiredText(
        data.nome_contato_recado || state.nome_contato_recado,
        120
      );

      if (!isValidPhone(telefonePrincipal)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'telefone_principal_invalido',
          reason: `Telefone principal inválido: ${data.telefone_principal || state.telefone_principal}`
        });
      }

      if (telefoneRecado && !isValidPhone(telefoneRecado)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'telefone_recado_invalido',
          reason: `Telefone para recado inválido: ${data.telefone_recado || state.telefone_recado}`
        });
      }

      return successNext('TIPO_DOCUMENTO', {
        ...state,
        telefone_principal: telefonePrincipal,
        telefone_recado: telefoneRecado,
        nome_contato_recado: nomeContatoRecado
      });
    }

    case 'TIPO_DOCUMENTO': {
      const tipo = String(data.tipo_documento || '').toUpperCase();

      if (!['RG', 'CNH'].includes(tipo)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'documento_nao_informado',
          reason: 'É necessário selecionar RG ou CNH para continuar.'
        });
      }

      return successNext('DOC_FRENTE', { ...state, tipo_documento: tipo });
    }

    case 'DOC_FRENTE': {
      const docFrente = normalizeMediaArray(data.doc_frente);
      if (!docFrente.length) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'doc_frente_obrigatorio',
          reason: 'A foto da frente do documento é obrigatória.'
        });
      }

      return successNext(state.tipo_documento === 'CNH' ? 'SELFIE_COM_DOC' : 'DOC_VERSO', {
        ...state,
        doc_frente: docFrente
      });
    }

    case 'DOC_VERSO': {
      const docVerso = normalizeMediaArray(data.doc_verso);
      if (!docVerso.length) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'doc_verso_obrigatorio',
          reason: 'A foto do verso do documento é obrigatória.'
        });
      }

      return successNext('SELFIE_COM_DOC', { ...state, doc_verso: docVerso });
    }

    case 'SELFIE_COM_DOC': {
      const selfie = normalizeMediaArray(data.selfie_com_doc);
      if (!selfie.length) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'selfie_com_doc_obrigatoria',
          reason: 'A selfie com documento é obrigatória.'
        });
      }

      return successNext('COMPROVANTE', { ...state, selfie_com_doc: selfie });
    }

    case 'COMPROVANTE': {
      const comprovante = normalizeMediaArray(data.comprovante_residencia);
      if (!comprovante.length) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'comprovante_obrigatorio',
          reason: 'O comprovante de residência é obrigatório.'
        });
      }

      return successNext('FACHADA', { ...state, comprovante_residencia: comprovante });
    }

    case 'FACHADA': {
      const fachada = normalizeMediaArray(data.fachada);
      if (!fachada.length) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'fachada_obrigatoria',
          reason: 'A foto da fachada é obrigatória.'
        });
      }

      return successNext('TV_LIGADA', { ...state, fachada });
    }

    case 'TV_LIGADA': {
      const tvLigada = normalizeMediaArray(data.tv_ligada);
      if (!tvLigada.length) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'tv_ligada_obrigatoria',
          reason: 'A foto da TV ligada é obrigatória.'
        });
      }

      const finalState = {
        ...state,
        tv_ligada: tvLigada
      };

      return successNext('RESUMO_FINAL', {
        ...finalState,
        resumo_texto: buildResumoTexto(finalState)
      });
    }

    case 'RESUMO_FINAL': {
      const decisaoResumo = String(data.decisao_resumo || '').toLowerCase();

      if (decisaoResumo === 'confirmar') {
        return successNext('CONFIRMACAO_FINAL', {
          ...state,
          resumo_texto: buildResumoTexto(state)
        });
      }

      if (decisaoResumo === 'encerrar') {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ajuste_externo_solicitado',
          reason: 'Fluxo encerrado para ajuste externo.'
        });
      }

      return failureResponse({
        protocolo: state.protocolo,
        code: 'decisao_resumo_invalida',
        reason: 'Escolha uma opção para continuar.'
      });
    }

    case 'CONFIRMACAO_FINAL': {
      const finalPayload = buildFinalPayload(state);
      const job = await enqueueJob({
        protocolo: finalPayload.protocolo || crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        data: {
          protocolo: finalPayload.protocolo,
          doc_frente: finalPayload.doc_frente,
          doc_verso: finalPayload.doc_verso,
          selfie_com_doc: finalPayload.selfie_com_doc,
          comprovante_residencia: finalPayload.comprovante_residencia,
          fachada: finalPayload.fachada,
          tv_ligada: finalPayload.tv_ligada
        }
      });

      return queuedResponse({
        protocolo: finalPayload.protocolo,
        jobId: job.id,
        extra: finalPayload
      });
    }

    default:
      return failureResponse({
        protocolo: state.protocolo,
        code: 'screen_not_supported',
        reason: `Screen ${screen} não suportada no backend.`
      });
  }
}
