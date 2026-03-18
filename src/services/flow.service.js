import crypto from 'crypto';
import {
  isValidCPF,
  isValidCepFormat,
  isValidPhone,
  normalizeCep,
  normalizeCpf,
  normalizePhone,
  requiredText,
  validateCepEligibility,
  validateCpfEligibility
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
  jobId = ''
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
      'Para que suas informações sejam processadas, é necessário tocar em Concluir.'
  });
}

export function failureResponse({ protocolo, code, reason, finishMessage = '' }) {
  return finishResponse({
    protocolo,
    status: 'failure',
    code,
    reason,
    finishMessage: finishMessage || reason
  });
}

export function queuedResponse({ protocolo, jobId }) {
  return finishResponse({
    protocolo,
    status: 'queued',
    code: 'queued_for_processing',
    reason: 'Dados recebidos e enviados para processamento.',
    finishMessage:
      'Se estiver tudo certo, toque em Concluir para que suas informações sejam processadas.',
    jobId: String(jobId || '')
  });
}

function successNext(screen, data = {}, extra = {}) {
  return screenResponse(screen, {
    ...data,
    status: 'success',
    reason_code: '',
    reason: '',
    ...extra
  });
}

function normalizeMediaArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCommonState(data = {}) {
  return {
    protocolo: protocolFromData(data),
    cpf: normalizeCpf(data.cpf),
    cpf_attempts: Number(data.cpf_attempts || 0),
    cpf_feedback: String(data.cpf_feedback || ''),
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
    doc_frente: normalizeMediaArray(data.doc_frente || data.foto_frente),
    doc_verso: normalizeMediaArray(data.doc_verso || data.foto_verso),
    selfie_com_doc: normalizeMediaArray(data.selfie_com_doc),
    comprovante_residencia: normalizeMediaArray(data.comprovante_residencia || data.comprovante),
    fachada: normalizeMediaArray(data.fachada),
    tv_ligada: normalizeMediaArray(data.tv_ligada)
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
    case 'cidade':
      return { ...state, cidade: nextValue };
    case 'uf':
      return { ...state, uf: nextValue.toUpperCase() };
    case 'complemento':
      return { ...state, complemento: nextValue };
    default:
      return null;
  }
}

export async function handleFlowStep({ screen, data, enqueueJob }) {
  const state = normalizeCommonState(data);

  switch (screen) {
    case 'INIT':
      return successNext('CPF_INPUT', state, { cpf_attempts: 0, cpf_feedback: '' });

    case 'CPF_INPUT': {
      const nextAttempts = Number(state.cpf_attempts || 0) + 1;

      console.log('[FLOW][CPF_INPUT] payload recebido:', JSON.stringify({
        cpf: state.cpf,
        telefone_principal: state.telefone_principal,
        cpf_attempts: state.cpf_attempts
      }, null, 2));

      if (!isValidCPF(state.cpf)) {
        if (nextAttempts >= 3) {
          return failureResponse({
            protocolo: state.protocolo,
            code: 'cpf_invalido_3_tentativas',
            reason: 'CPF inválido após 3 tentativas.',
            finishMessage:
              'Não foi possível continuar porque o CPF foi informado incorretamente 3 vezes.'
          });
        }

        const remaining = 3 - nextAttempts;
        return successNext('CPF_INPUT', state, {
          cpf_attempts: nextAttempts,
          cpf_feedback:
            remaining === 1
              ? 'CPF inválido. Confira os números e tente novamente. Você ainda tem mais 1 tentativa.'
              : 'CPF inválido. Confira os números e tente novamente.'
        });
      }

      const eligibility = await validateCpfEligibility(
        state.cpf,
        state.protocolo,
        state.telefone_principal
      );

      console.log('[FLOW][CPF_INPUT] validation result:', JSON.stringify(eligibility, null, 2));

      if (!eligibility.eligible) {
        return failureResponse({
          protocolo: eligibility.protocolo || state.protocolo,
          code: 'nao_elegivel',
          reason: 'CPF não elegível para continuar.'
        });
      }

      if (!eligibility.extraPhaseEligible) {
        return failureResponse({
          protocolo: eligibility.protocolo || state.protocolo,
          code: 'sem_fase_extra',
          reason: 'Não foi identificada fase extra para este cadastro.'
        });
      }

      if (eligibility.hasInstallation) {
        return failureResponse({
          protocolo: eligibility.protocolo || state.protocolo,
          code: 'ja_possui_instalacao',
          reason: `Já existe instalação vinculada a este cadastro${
            eligibility.protocoloExistente ? ` (${eligibility.protocoloExistente})` : ''
          }.`
        });
      }

      if (eligibility.hasScheduleForCpf) {
        return failureResponse({
          protocolo: eligibility.protocolo || state.protocolo,
          code: 'ja_possui_agendamento_cpf',
          reason: `Já existe agendamento para este CPF${
            eligibility.protocoloExistente ? ` (${eligibility.protocoloExistente})` : ''
          }.`
        });
      }

      if (eligibility.hasScheduleForFamilyCode) {
        return failureResponse({
          protocolo: eligibility.protocolo || state.protocolo,
          code: 'ja_possui_agendamento_codigo_familia',
          reason: `Já existe agendamento para este código família${
            eligibility.protocoloExistente ? ` (${eligibility.protocoloExistente})` : ''
          }.`
        });
      }

      const nextState = {
        ...state,
        protocolo: String(eligibility.protocolo || state.protocolo || '').trim(),
        nome: eligibility.nome || state.nome,
        family_code: eligibility.familyCode || state.family_code,
        cep: normalizeCep(eligibility.cep || state.cep),
        logradouro: String(eligibility.logradouro || state.logradouro || '').trim(),
        bairro: String(eligibility.bairro || state.bairro || '').trim(),
        cidade: String(eligibility.cidade || state.cidade || '').trim(),
        uf: String(eligibility.uf || state.uf || '').trim().toUpperCase(),
        complemento:
          eligibility.complemento == null
            ? String(state.complemento || '')
            : String(eligibility.complemento).trim(),
        ibge: String(eligibility.ibge || state.ibge || '').trim(),
        telefone_principal: normalizePhone(
          eligibility.telefone_principal || state.telefone_principal
        ),
        cpf_attempts: 0,
        cpf_feedback: ''
      };

      const addressExists = hasBaseAddress(nextState);

      console.log('[FLOW][CPF_INPUT] address decision inputs:', JSON.stringify({
        cep: nextState.cep,
        logradouro: nextState.logradouro,
        bairro: nextState.bairro,
        cidade: nextState.cidade,
        uf: nextState.uf,
        complemento: nextState.complemento,
        hasBaseAddress: addressExists,
        missingAddressFields: missingAddressDetails(nextState)
      }, null, 2));

      const nextScreen = addressExists ? 'CONFIRMA_ENDERECO_ONE' : 'CEP_REINPUT';

      console.log('[FLOW][CPF_INPUT] nextScreen selected:', nextScreen);

      return successNext(nextScreen, nextState);
    }

    case 'CONFIRMA_ENDERECO_ONE': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();

      console.log('[FLOW][CONFIRMA_ENDERECO_ONE] state:', JSON.stringify({
        cep: state.cep,
        logradouro: state.logradouro,
        bairro: state.bairro,
        cidade: state.cidade,
        uf: state.uf,
        complemento: state.complemento,
        missingAddressFields: missingAddressDetails(state),
        decisao
      }, null, 2));

      if (decisao === 'confirmar') {
        const nextScreen = needsAddressComplement(state)
          ? 'COMPLEMENTAR_ENDERECO_CADASTRAL'
          : 'ENDERECO_COMPLETO';

        console.log('[FLOW][CONFIRMA_ENDERECO_ONE] nextScreen selected:', nextScreen);
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
      const complemento = requiredText(data.complemento, 120);

      console.log('[FLOW][COMPLEMENTAR_ENDERECO_CADASTRAL] payload:', JSON.stringify({
        logradouro,
        bairro,
        complemento
      }, null, 2));

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
      const camposPermitidos = ['cep', 'logradouro', 'bairro', 'cidade', 'uf', 'complemento'];

      if (!camposPermitidos.includes(campo)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'campo_endereco_invalido',
          reason: 'Selecione qual campo do endereço deseja alterar.'
        });
      }

      if (campo === 'cep') {
        return successNext('CEP_REINPUT', { ...state, campo_endereco: campo });
      }

      return successNext('EDITAR_CAMPO_ENDERECO', { ...state, campo_endereco: campo });
    }

    case 'EDITAR_CAMPO_ENDERECO': {
      const campo = state.campo_endereco;
      const valor = requiredText(data.valor_campo_endereco, 120);

      if (!campo || !['logradouro', 'bairro', 'cidade', 'uf', 'complemento'].includes(campo)) {
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

      console.log('[FLOW][CONFIRMA_ENDERECO_AJUSTADO] state:', JSON.stringify({
        cep: state.cep,
        logradouro: state.logradouro,
        bairro: state.bairro,
        cidade: state.cidade,
        uf: state.uf,
        complemento: state.complemento,
        missingAddressFields: missingAddressDetails(state),
        decisao
      }, null, 2));

      if (decisao === 'confirmar') {
        const nextScreen = needsAddressComplement(state)
          ? 'COMPLEMENTAR_ENDERECO_CADASTRAL'
          : 'ENDERECO_COMPLETO';

        console.log('[FLOW][CONFIRMA_ENDERECO_AJUSTADO] nextScreen selected:', nextScreen);
        return successNext(nextScreen, state);
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
      console.log('[FLOW][CEP_REINPUT] state antes da validação:', JSON.stringify({
        cep: state.cep,
        protocolo: state.protocolo
      }, null, 2));

      if (!isValidCepFormat(state.cep)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'cep_invalido',
          reason: 'CEP inválido. Informe os 8 números do CEP.'
        });
      }

      const cepValidation = await validateCepEligibility(state.cep, state.protocolo);

      console.log('[FLOW][CEP_REINPUT] cep validation:', JSON.stringify(cepValidation, null, 2));

      if (!cepValidation.ok) {
        return failureResponse({
          protocolo: state.protocolo,
          code: cepValidation.code,
          reason: cepValidation.reason
        });
      }

      return successNext('CONFIRMA_ENDERECO_TWO', {
        ...state,
        cep: cepValidation.address.cep,
        logradouro: state.logradouro,
        bairro: state.bairro,
        cidade: state.cidade,
        uf: state.uf,
        complemento: state.complemento,
        ibge: state.ibge
      });
    }

    case 'CONFIRMA_ENDERECO_TWO': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();

      console.log('[FLOW][CONFIRMA_ENDERECO_TWO] state:', JSON.stringify({
        cep: state.cep,
        logradouro: state.logradouro,
        bairro: state.bairro,
        cidade: state.cidade,
        uf: state.uf,
        complemento: state.complemento,
        missingAddressFields: missingAddressDetails(state),
        decisao
      }, null, 2));

      if (decisao === 'confirmar') {
        const nextScreen = needsAddressComplement(state)
          ? 'COMPLEMENTAR_ENDERECO_CADASTRAL'
          : 'ENDERECO_COMPLETO';

        console.log('[FLOW][CONFIRMA_ENDERECO_TWO] nextScreen selected:', nextScreen);
        return successNext(nextScreen, state);
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
      const numero = requiredText(data.numero, 20);
      const pontoReferencia = requiredText(data.ponto_referencia, 180);

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
      const telefonePrincipal = normalizePhone(state.telefone_principal);
      const telefoneRecado = normalizePhone(state.telefone_recado);

      if (!isValidPhone(telefonePrincipal)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'telefone_principal_invalido',
          reason: `Telefone principal inválido: ${state.telefone_principal}`
        });
      }

      if (telefoneRecado && !isValidPhone(telefoneRecado)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'telefone_recado_invalido',
          reason: `Telefone para recado inválido: ${state.telefone_recado}`
        });
      }

      return successNext('TIPO_DOCUMENTO', {
        ...state,
        telefone_principal: telefonePrincipal,
        telefone_recado: telefoneRecado
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

      const job = await enqueueJob({
        protocolo: finalState.protocolo || crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        data: finalState
      });

      return queuedResponse({
        protocolo: finalState.protocolo,
        jobId: job.id
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