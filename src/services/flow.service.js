function screenResponse(screen, data = {}) {
  return { screen, data };
}

function toStr(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeState(data = {}) {
  return {
    protocolo: toStr(data.protocolo),
    cpf: toStr(data.cpf),
    nome: toStr(data.nome),
    family_code: toStr(data.family_code),
    telefone_principal: toStr(data.telefone_principal),
    cep: toStr(data.cep),
    logradouro: toStr(data.logradouro),
    bairro: toStr(data.bairro),
    cidade: toStr(data.cidade),
    uf: toStr(data.uf),
    complemento: toStr(data.complemento),
    dados_corretos: toStr(data.dados_corretos)
  };
}

export async function handleFlowStep({ screen, data }) {
  const state = normalizeState(data);

  switch (screen) {
    case 'INIT':
      return screenResponse('TESTE_DADOS', {
        protocolo: state.protocolo,
        cpf: state.cpf,
        nome: state.nome,
        family_code: state.family_code,
        telefone_principal: state.telefone_principal,
        cep: state.cep,
        logradouro: state.logradouro,
        bairro: state.bairro,
        cidade: state.cidade,
        uf: state.uf,
        complemento: state.complemento
      });

    case 'TESTE_DADOS': {
      const resposta = toStr(data?.dados_corretos).toLowerCase();

      if (!resposta) {
        return screenResponse('RESULTADO', {
          status: 'erro',
          protocolo: state.protocolo,
          cpf: state.cpf,
          nome: state.nome,
          dados_corretos: '',
          mensagem_resultado: 'Nenhuma opção foi selecionada.'
        });
      }

      if (resposta === 'sim') {
        return screenResponse('RESULTADO', {
          status: 'ok',
          protocolo: state.protocolo,
          cpf: state.cpf,
          nome: state.nome,
          dados_corretos: 'sim',
          mensagem_resultado: 'Dados confirmados com sucesso.'
        });
      }

      if (resposta === 'nao') {
        return screenResponse('RESULTADO', {
          status: 'revisar',
          protocolo: state.protocolo,
          cpf: state.cpf,
          nome: state.nome,
          dados_corretos: 'nao',
          mensagem_resultado: 'Usuário informou que os dados não estão corretos.'
        });
      }

      return screenResponse('RESULTADO', {
        status: 'erro',
        protocolo: state.protocolo,
        cpf: state.cpf,
        nome: state.nome,
        dados_corretos: resposta,
        mensagem_resultado: 'Valor inválido para dados_corretos.'
      });
    }

    default:
      return screenResponse('RESULTADO', {
        status: 'erro',
        protocolo: state.protocolo,
        cpf: state.cpf,
        nome: state.nome,
        dados_corretos: '',
        mensagem_resultado: `Screen ${screen} não suportada.`
      });
  }
}