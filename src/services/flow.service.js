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
  return String(data.protocolo || data.protocolNumber || crypto.randomUUID()).trim();
}

function screenResponse(screen, data = {}) {
  return { screen, data };
}

function finishResponse({ protocolo, status = 'failure', code = 'flow_finished', reason = '', finishMessage = '', jobId = '' }) {
  return screenResponse('FINISH', {
    protocolo,
    status,
    reason_code: code,
    reason,
    job_id: jobId,
    finish_message: finishMessage || reason || 'Fluxo finalizado.'
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
    finishMessage: 'Recebemos seus dados com sucesso e o processamento foi iniciado.',
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
    family_code: String(data.family_code || ''),
    telefone_principal: normalizePhone(data.telefone_principal),
    telefone_recado: normalizePhone(data.telefone_recado),
    nome_contato_recado: String(data.nome_contato_recado || ''),
    cep: normalizeCep(data.cep),
    logradouro: String(data.logradouro || ''),
    numero: String(data.numero || ''),
    bairro: String(data.bairro || ''),
    complemento: String(data.complemento || ''),
    cidade: String(data.cidade || ''),
    uf: String(data.uf || data.estado || ''),
    ibge: String(data.ibge || ''),
    ponto_referencia: String(data.ponto_referencia || ''),
    tipo_documento: String(data.tipo_documento || '').toUpperCase(),
    doc_frente: normalizeMediaArray(data.doc_frente || data.foto_frente),
    doc_verso: normalizeMediaArray(data.doc_verso || data.foto_verso),
    selfie_com_doc: normalizeMediaArray(data.selfie_com_doc),
    comprovante_residencia: normalizeMediaArray(data.comprovante_residencia || data.comprovante),
    fachada: normalizeMediaArray(data.fachada),
    tv_ligada: normalizeMediaArray(data.tv_ligada)
  };
}

function buildResumo(state) {
  return [
    `Nome: ${state.nome || '-'}`,
    `CPF: ${state.cpf || '-'}`,
    `Telefone principal: ${state.telefone_principal || '-'}`,
    `Telefone recado: ${state.telefone_recado || '-'}`,
    `Contato recado: ${state.nome_contato_recado || '-'}`,
    `CEP: ${state.cep || '-'}`,
    `Logradouro: ${state.logradouro || '-'}`,
    `Número: ${state.numero || '-'}`,
    `Bairro: ${state.bairro || '-'}`,
    `Cidade: ${state.cidade || '-'}`,
    `UF: ${state.uf || '-'}`,
    `Complemento: ${state.complemento || '-'}`,
    `Ponto de referência: ${state.ponto_referencia || '-'}`,
    `Documento: ${state.tipo_documento || '-'}`
  ].join('\n');
}

export async function handleFlowStep({ screen, data, enqueueJob }) {
  const state = normalizeCommonState(data);

  switch (screen) {
    case 'INIT':
      return successNext('CPF_INPUT', state, { cpf_attempts: 0, cpf_feedback: '' });

    case 'CPF_INPUT': {
      const nextAttempts = Number(state.cpf_attempts || 0) + 1;

      if (!isValidCPF(state.cpf)) {
        if (nextAttempts >= 3) {
          return failureResponse({
            protocolo: state.protocolo,
            code: 'cpf_invalido_3_tentativas',
            reason: 'CPF inválido após 3 tentativas.',
            finishMessage: 'Não foi possível continuar porque o CPF foi informado incorretamente 3 vezes.'
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

      const eligibility = await validateCpfEligibility(state.cpf);
      if (!eligibility.eligible) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'nao_elegivel',
          reason: 'CPF não elegível para continuar.'
        });
      }
      if (!eligibility.extraPhaseEligible) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'sem_fase_extra',
          reason: 'Não foi identificada fase extra para este cadastro.'
        });
      }
      if (eligibility.hasInstallation) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ja_possui_instalacao',
          reason: `Já existe instalação vinculada a este cadastro${eligibility.protocoloExistente ? ` (${eligibility.protocoloExistente})` : ''}.`
        });
      }
      if (eligibility.hasScheduleForCpf) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ja_possui_agendamento_cpf',
          reason: `Já existe agendamento para este CPF${eligibility.protocoloExistente ? ` (${eligibility.protocoloExistente})` : ''}.`
        });
      }
      if (eligibility.hasScheduleForFamilyCode) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ja_possui_agendamento_codigo_familia',
          reason: `Já existe agendamento para este código família${eligibility.protocoloExistente ? ` (${eligibility.protocoloExistente})` : ''}.`
        });
      }

      return successNext('TELEFONE_PRINCIPAL', {
        ...state,
        nome: eligibility.nome || state.nome,
        family_code: eligibility.familyCode || state.family_code,
        cpf_attempts: 0,
        cpf_feedback: ''
      });
    }

    case 'TELEFONE_PRINCIPAL': {
      if (!isValidPhone(state.telefone_principal)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'telefone_principal_invalido',
          reason: 'Telefone principal inválido.'
        });
      }
      return successNext('TELEFONE_RECADO', state);
    }

    case 'TELEFONE_RECADO': {
      if (!isValidPhone(state.telefone_recado)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'telefone_recado_invalido',
          reason: 'Telefone para recado inválido.'
        });
      }
      if (!requiredText(data.nome_contato_recado, 120)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'nome_contato_recado_obrigatorio',
          reason: 'Nome do contato de recado é obrigatório.'
        });
      }
      return successNext('CEP_INPUT', {
        ...state,
        nome_contato_recado: requiredText(data.nome_contato_recado, 120)
      });
    }

    case 'CEP_INPUT':
    case 'CEP_REINPUT': {
      if (!isValidCepFormat(state.cep)) {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'cep_invalido',
          reason: 'CEP inválido. Informe os 8 números do CEP.'
        });
      }

      const cepValidation = await validateCepEligibility(state.cep);
      if (!cepValidation.ok) {
        return failureResponse({
          protocolo: state.protocolo,
          code: cepValidation.code,
          reason: cepValidation.reason
        });
      }

      return successNext(screen === 'CEP_INPUT' ? 'CONFIRMA_ENDERECO_CEP_1' : 'CONFIRMA_ENDERECO_CEP_2', {
        ...state,
        cep: cepValidation.address.cep,
        logradouro: cepValidation.address.street,
        bairro: cepValidation.address.neighborhood,
        cidade: cepValidation.address.city,
        uf: cepValidation.address.state,
        ibge: cepValidation.address.ibge || ''
      });
    }

    case 'CONFIRMA_ENDERECO_CEP_1': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();
      if (decisao === 'confirmar') {
        return successNext('COMPLEMENTA_ENDERECO', state);
      }
      if (decisao === 'corrigir') {
        return successNext('CEP_REINPUT', state);
      }
      return failureResponse({
        protocolo: state.protocolo,
        code: 'confirmacao_endereco_invalida',
        reason: 'Escolha uma opção para continuar.'
      });
    }

    case 'CONFIRMA_ENDERECO_CEP_2': {
      const decisao = String(data.decisao_endereco || '').toLowerCase();
      if (decisao === 'confirmar') {
        return successNext('COMPLEMENTA_ENDERECO', state);
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

    case 'COMPLEMENTA_ENDERECO': {
      const numero = requiredText(data.numero, 20);
      const bairro = requiredText(data.bairro || state.bairro, 100);
      const complemento = requiredText(data.complemento, 120);
      if (!numero) {
        return failureResponse({ protocolo: state.protocolo, code: 'numero_obrigatorio', reason: 'Número da residência é obrigatório.' });
      }
      if (!bairro) {
        return failureResponse({ protocolo: state.protocolo, code: 'bairro_obrigatorio', reason: 'Bairro é obrigatório.' });
      }
      return successNext('PONTO_REFERENCIA', { ...state, numero, bairro, complemento });
    }

    case 'PONTO_REFERENCIA': {
      const ponto = requiredText(data.ponto_referencia, 180);
      if (!ponto) {
        return failureResponse({ protocolo: state.protocolo, code: 'ponto_referencia_obrigatorio', reason: 'Ponto de referência é obrigatório.' });
      }
      return successNext('TIPO_DOCUMENTO', { ...state, ponto_referencia: ponto });
    }

    case 'TIPO_DOCUMENTO': {
      const tipo = String(data.tipo_documento || '').toUpperCase();
      if (!['RG', 'CNH'].includes(tipo)) {
        return failureResponse({ protocolo: state.protocolo, code: 'documento_nao_informado', reason: 'É necessário selecionar RG ou CNH para continuar.' });
      }
      return successNext('DOC_FRENTE', { ...state, tipo_documento: tipo });
    }

    case 'DOC_FRENTE': {
      const docFrente = normalizeMediaArray(data.doc_frente);
      if (!docFrente.length) {
        return failureResponse({ protocolo: state.protocolo, code: 'doc_frente_obrigatorio', reason: 'A foto da frente do documento é obrigatória.' });
      }
      return successNext(state.tipo_documento === 'CNH' ? 'SELFIE_COM_DOC' : 'DOC_VERSO', { ...state, doc_frente: docFrente });
    }

    case 'DOC_VERSO': {
      const docVerso = normalizeMediaArray(data.doc_verso);
      if (!docVerso.length) {
        return failureResponse({ protocolo: state.protocolo, code: 'doc_verso_obrigatorio', reason: 'A foto do verso do documento é obrigatória.' });
      }
      return successNext('SELFIE_COM_DOC', { ...state, doc_verso: docVerso });
    }

    case 'SELFIE_COM_DOC': {
      const selfie = normalizeMediaArray(data.selfie_com_doc);
      if (!selfie.length) {
        return failureResponse({ protocolo: state.protocolo, code: 'selfie_com_doc_obrigatoria', reason: 'A selfie com documento é obrigatória.' });
      }
      return successNext('COMPROVANTE', { ...state, selfie_com_doc: selfie });
    }

    case 'COMPROVANTE': {
      const comprovante = normalizeMediaArray(data.comprovante_residencia);
      if (!comprovante.length) {
        return failureResponse({ protocolo: state.protocolo, code: 'comprovante_obrigatorio', reason: 'O comprovante de residência é obrigatório.' });
      }
      return successNext('FACHADA', { ...state, comprovante_residencia: comprovante });
    }

    case 'FACHADA': {
      const fachada = normalizeMediaArray(data.fachada);
      if (!fachada.length) {
        return failureResponse({ protocolo: state.protocolo, code: 'fachada_obrigatoria', reason: 'A foto da fachada é obrigatória.' });
      }
      return successNext('TV_LIGADA', { ...state, fachada });
    }

    case 'TV_LIGADA': {
      const tvLigada = normalizeMediaArray(data.tv_ligada);
      if (!tvLigada.length) {
        return failureResponse({ protocolo: state.protocolo, code: 'tv_ligada_obrigatoria', reason: 'A foto da TV ligada é obrigatória.' });
      }
      return successNext('RESUMO_FINAL', {
        ...state,
        tv_ligada: tvLigada,
        resumo_texto: buildResumo({ ...state, tv_ligada: tvLigada })
      });
    }

    case 'RESUMO_FINAL': {
      const decisao = String(data.decisao_resumo || '').toLowerCase();
      if (decisao === 'confirmar') {
        return successNext('CONFIRMACAO_FINAL', state);
      }
      if (decisao === 'encerrar') {
        return failureResponse({
          protocolo: state.protocolo,
          code: 'ajuste_manual_solicitado',
          reason: 'Usuário solicitou ajuste externo antes do envio final.'
        });
      }
      return failureResponse({
        protocolo: state.protocolo,
        code: 'resumo_sem_decisao',
        reason: 'Escolha uma opção para continuar.'
      });
    }

    case 'CONFIRMACAO_FINAL': {
      const job = await enqueueJob({
        protocolo: state.protocolo,
        submittedAt: new Date().toISOString(),
        data: state
      });

      return queuedResponse({ protocolo: state.protocolo, jobId: job.id });
    }

    default:
      return failureResponse({
        protocolo: state.protocolo,
        code: 'screen_not_supported',
        reason: `Screen ${screen} não suportada no backend.`
      });
  }
}
