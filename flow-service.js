import crypto from "crypto";
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
} from "./validations.js";

function protocolFromData(data = {}) {
  return String(data.protocolo || data.protocolNumber || crypto.randomUUID()).trim();
}

function extensionResponse(flowToken, payload = {}) {
  return {
    extension_message_response: {
      params: {
        flow_token: flowToken,
        ...payload
      }
    }
  };
}

function screenResponse(screen, data = {}) {
  return { screen, data };
}

export function failureResponse({ flowToken, protocolo, code, reason, detail = "" }) {
  return screenResponse("FINISH", {
    protocolo,
    status: "failure",
    reason_code: code,
    reason: reason,
    detail,
    summary_text: reason,
    ...extensionResponse(flowToken, {
      protocolo,
      status: "failure",
      reason_code: code,
      reason,
      detail
    })
  });
}

export function queuedResponse({ flowToken, protocolo, jobId }) {
  return screenResponse("FINISH", {
    protocolo,
    status: "queued",
    reason_code: "queued_for_processing",
    reason: "Dados recebidos e enviados para processamento.",
    detail: jobId,
    summary_text: "Seus dados foram enviados para processamento.",
    ...extensionResponse(flowToken, {
      protocolo,
      status: "queued",
      reason_code: "queued_for_processing",
      reason: "Dados recebidos e enviados para processamento.",
      job_id: jobId
    })
  });
}

function successNext(screen, flowToken, data = {}, extra = {}) {
  return screenResponse(screen, {
    ...data,
    status: "success",
    reason_code: "",
    reason: "",
    ...extra,
    ...extensionResponse(flowToken, {
      protocolo: data.protocolo,
      status: "success",
      next_screen: screen
    })
  });
}

function normalizeCommonState(data = {}) {
  return {
    protocolo: protocolFromData(data),
    cpf: normalizeCpf(data.cpf),
    nome: String(data.nome || ""),
    family_code: String(data.family_code || ""),
    telefone_principal: normalizePhone(data.telefone_principal),
    telefone_recado: normalizePhone(data.telefone_recado),
    cep: normalizeCep(data.cep),
    logradouro: String(data.logradouro || ""),
    numero: String(data.numero || ""),
    bairro: String(data.bairro || ""),
    complemento: String(data.complemento || ""),
    cidade: String(data.cidade || ""),
    estado: String(data.estado || ""),
    ponto_referencia: String(data.ponto_referencia || ""),
    tipo_documento: String(data.tipo_documento || ""),
    foto_frente: data.foto_frente || [],
    foto_verso: data.foto_verso || [],
    selfie_com_doc: data.selfie_com_doc || [],
    comprovante: data.comprovante || [],
    fachada: data.fachada || [],
    tv_ligada: data.tv_ligada || []
  };
}

export async function handleFlowStep({ screen, data, flowToken, enqueueJob }) {
  const state = normalizeCommonState(data);

  switch (screen) {
    case "INIT":
      return successNext("CPF_INPUT", flowToken, state);

    case "CPF_INPUT": {
      if (!isValidCPF(state.cpf)) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "cpf_invalido",
          reason: "CPF inválido."
        });
      }

      const eligibility = await validateCpfEligibility(state.cpf);
      if (!eligibility.eligible) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "nao_elegivel",
          reason: "CPF não elegível para continuar."
        });
      }
      if (!eligibility.extraPhaseEligible) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "sem_fase_extra",
          reason: "Não foi identificada fase extra para este cadastro."
        });
      }
      if (eligibility.hasInstallation) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "ja_possui_instalacao",
          reason: "Já existe instalação vinculada a este cadastro.",
          detail: eligibility.protocoloExistente
        });
      }
      if (eligibility.hasScheduleForCpf) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "ja_possui_agendamento_cpf",
          reason: "Já existe agendamento para este CPF.",
          detail: eligibility.protocoloExistente
        });
      }
      if (eligibility.hasScheduleForFamilyCode) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "ja_possui_agendamento_codigo_familia",
          reason: "Já existe agendamento para este código família.",
          detail: eligibility.protocoloExistente
        });
      }

      return successNext("TELEFONE_PRINCIPAL", flowToken, {
        ...state,
        nome: eligibility.nome || state.nome,
        family_code: eligibility.familyCode || state.family_code
      });
    }

    case "TELEFONE_PRINCIPAL": {
      if (!isValidPhone(state.telefone_principal)) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "telefone_principal_invalido",
          reason: "Telefone principal inválido."
        });
      }
      return successNext("TELEFONE_RECADO", flowToken, state);
    }

    case "TELEFONE_RECADO": {
      if (state.telefone_recado && !isValidPhone(state.telefone_recado)) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "telefone_recado_invalido",
          reason: "Telefone para recado inválido."
        });
      }
      return successNext("CEP_INPUT", flowToken, state);
    }

    case "CEP_INPUT": {
      if (!isValidCepFormat(state.cep)) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "cep_invalido",
          reason: "CEP inválido. Informe os 8 números do CEP."
        });
      }
      const cepValidation = await validateCepEligibility(state.cep);
      if (!cepValidation.ok) {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: cepValidation.code,
          reason: cepValidation.reason
        });
      }

      return successNext("CONFIRMA_ENDERECO_CEP", flowToken, {
        ...state,
        cep: cepValidation.address.cep,
        logradouro: cepValidation.address.street,
        bairro: cepValidation.address.neighborhood,
        cidade: cepValidation.address.city,
        estado: cepValidation.address.state,
        ibge: cepValidation.address.ibge || ""
      });
    }

    case "CONFIRMA_ENDERECO_CEP": {
      const confirmar = String(data.confirmar_endereco_cep || "").toLowerCase();
      if (confirmar === "nao") {
        return successNext("CEP_INPUT", flowToken, state);
      }
      if (confirmar !== "sim") {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "confirmacao_endereco_invalida",
          reason: "Confirmação do endereço não informada."
        });
      }
      return successNext("COMPLEMENTA_ENDERECO", flowToken, state);
    }

    case "COMPLEMENTA_ENDERECO": {
      const numero = requiredText(data.numero, 20);
      const bairro = requiredText(data.bairro || state.bairro, 100);
      const complemento = requiredText(data.complemento, 120);
      if (!numero) {
        return failureResponse({ flowToken, protocolo: state.protocolo, code: "numero_obrigatorio", reason: "Número da residência é obrigatório." });
      }
      if (!bairro) {
        return failureResponse({ flowToken, protocolo: state.protocolo, code: "bairro_obrigatorio", reason: "Bairro é obrigatório." });
      }
      return successNext("PONTO_REFERENCIA", flowToken, { ...state, numero, bairro, complemento });
    }

    case "PONTO_REFERENCIA": {
      const ponto = requiredText(data.ponto_referencia, 180);
      if (!ponto) {
        return failureResponse({ flowToken, protocolo: state.protocolo, code: "ponto_referencia_obrigatorio", reason: "Ponto de referência é obrigatório." });
      }
      return successNext("TIPO_DOCUMENTO", flowToken, { ...state, ponto_referencia: ponto });
    }

    case "TIPO_DOCUMENTO": {
      const tipo = String(data.tipo_documento || "").toUpperCase();
      if (!["RG", "CNH"].includes(tipo)) {
        return failureResponse({ flowToken, protocolo: state.protocolo, code: "documento_nao_informado", reason: "É necessário selecionar RG ou CNH para continuar." });
      }
      return successNext("DOC_FRENTE", flowToken, { ...state, tipo_documento: tipo });
    }

    case "DOC_FRENTE":
      return successNext("DOC_VERSO", flowToken, { ...state, foto_frente: data.foto_frente || [] });

    case "DOC_VERSO":
      return successNext("SELFIE_COM_DOC", flowToken, { ...state, foto_verso: data.foto_verso || [] });

    case "SELFIE_COM_DOC":
      return successNext("COMPROVANTE", flowToken, { ...state, selfie_com_doc: data.selfie_com_doc || [] });

    case "COMPROVANTE":
      return successNext("FACHADA", flowToken, { ...state, comprovante: data.comprovante || [] });

    case "FACHADA":
      return successNext("TV_LIGADA", flowToken, { ...state, fachada: data.fachada || [] });

    case "TV_LIGADA": {
      return successNext("RESUMO_FINAL", flowToken, {
        ...state,
        tv_ligada: data.tv_ligada || [],
        resumo_texto: [
          `Nome: ${state.nome || "-"}`,
          `CPF: ${state.cpf || "-"}`,
          `Telefone principal: ${state.telefone_principal || "-"}`,
          `Telefone recado: ${state.telefone_recado || "-"}`,
          `CEP: ${state.cep || "-"}`,
          `Logradouro: ${state.logradouro || "-"}`,
          `Número: ${state.numero || "-"}`,
          `Bairro: ${state.bairro || "-"}`,
          `Cidade: ${state.cidade || "-"}`,
          `Estado: ${state.estado || "-"}`,
          `Complemento: ${state.complemento || "-"}`,
          `Ponto de referência: ${state.ponto_referencia || "-"}`,
          `Documento: ${state.tipo_documento || "-"}`
        ].join("\n")
      });
    }

    case "RESUMO_FINAL":
      return successNext("CONFIRMACAO_FINAL", flowToken, state);

    case "CONFIRMACAO_FINAL": {
      const confirmar = String(data.confirmacao_final || "").toLowerCase();
      if (confirmar !== "sim") {
        return failureResponse({
          flowToken,
          protocolo: state.protocolo,
          code: "confirmacao_negada",
          reason: "Dados não confirmados pelo usuário."
        });
      }

      const job = await enqueueJob({
        protocolo: state.protocolo,
        flowToken,
        submittedAt: new Date().toISOString(),
        data: state
      });

      return queuedResponse({ flowToken, protocolo: state.protocolo, jobId: job.id });
    }

    default:
      return failureResponse({
        flowToken,
        protocolo: state.protocolo,
        code: "screen_not_supported",
        reason: `Screen ${screen} não suportada no backend.`
      });
  }
}
