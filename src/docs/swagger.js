import swaggerJsdoc from 'swagger-jsdoc';

function cleanUrl(url = '') {
  return String(url || '').replace(/\/+$/g, '');
}

export function buildOpenApiSpec(env = process.env) {
  const serverUrl = cleanUrl(env.SWAGGER_BASE_URL || `http://localhost:${env.PORT || 3005}`);

  return swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'WPF Base Proxy API',
        version: '1.1.0',
        description: 'API de proxy para ocultar a URL original do CRM, centralizar autenticação e expor documentação Swagger.'
      },
      servers: [{ url: serverUrl }],
      tags: [
        { name: 'Health', description: 'Endpoints de status da aplicação' },
        { name: 'Auth', description: 'Token para uso externo e interno' },
        { name: 'Proxy CRM', description: 'Endpoints proxy com gestão automática do token' }
      ],
      components: {
        schemas: {
          GenericProxySuccess: {
            type: 'object',
            properties: {
              ok: { type: 'boolean', example: true },
              data: {
                type: 'object',
                additionalProperties: true
              }
            }
          },
          GenericError: {
            type: 'object',
            properties: {
              ok: { type: 'boolean', example: false },
              error: { type: 'string', example: 'validation_error' },
              message: { type: 'string', example: 'ticketId é obrigatório.' },
              upstreamStatus: { type: 'integer', example: 401 },
              details: {
                type: 'object',
                nullable: true,
                additionalProperties: true
              }
            }
          },
          TokenSuccess: {
            type: 'object',
            properties: {
              ok: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  token: { type: 'string', example: 'eyJhbGciOi...' },
                  tokenType: { type: 'string', example: 'Bearer' },
                  authorization: { type: 'string', example: 'Bearer eyJhbGciOi...' }
                }
              }
            }
          },
          ScheduleRequest: {
            type: 'object',
            additionalProperties: true,
            example: {
              protocol: '2026001234',
              appointmentDate: '2026-03-20',
              shift: 'MORNING'
            }
          },
          TicketCustomerRequest: {
            type: 'object',
            additionalProperties: true,
            example: {
              protocol: '2026001234',
              customerName: 'João da Silva',
              phone: '85999999999'
            }
          }
        }
      },
      paths: {
        '/health': {
          get: {
            tags: ['Health'],
            summary: 'Healthcheck da aplicação',
            responses: {
              200: {
                description: 'Aplicação saudável'
              }
            }
          }
        },
        '/openapi.json': {
          get: {
            tags: ['Health'],
            summary: 'Retorna a especificação OpenAPI em JSON',
            responses: {
              200: { description: 'Spec OpenAPI gerada com sucesso' }
            }
          }
        },
        '/proxy/token': {
          get: {
            tags: ['Auth'],
            summary: 'Obter token do CRM para consumo externo',
            description: 'Também é usado internamente pelo proxy. Use forceRefresh=true para forçar a renovação.',
            parameters: [
              {
                name: 'forceRefresh',
                in: 'query',
                required: false,
                schema: { type: 'boolean' },
                description: 'Força a renovação do token ignorando o cache em memória.'
              }
            ],
            responses: {
              200: {
                description: 'Token obtido com sucesso',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/TokenSuccess' }
                  }
                }
              }
            }
          }
        },
        '/proxy/service-order/schedule': {
          post: {
            tags: ['Proxy CRM'],
            summary: 'Escolher a data de agendamento',
            description: 'Encaminha a chamada para o CRM usando CRM_BASE_URL e injeta o token automaticamente.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ScheduleRequest' }
                }
              }
            },
            responses: {
              200: {
                description: 'Agendamento encaminhado com sucesso',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericProxySuccess' }
                  }
                }
              },
              400: {
                description: 'Erro de validação',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericError' }
                  }
                }
              },
              401: {
                description: 'Erro de autenticação no upstream',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericError' }
                  }
                }
              }
            }
          }
        },
        '/proxy/capacity/availabilities': {
          get: {
            tags: ['Proxy CRM'],
            summary: 'Consultar disponibilidades de agenda',
            parameters: [
              {
                name: 'postalCode',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'CEP do cliente.'
              },
              {
                name: 'protocol',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'Protocolo do atendimento.'
              }
            ],
            responses: {
              200: {
                description: 'Consulta realizada com sucesso',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericProxySuccess' }
                  }
                }
              },
              400: {
                description: 'Erro de validação',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericError' }
                  }
                }
              }
            }
          }
        },
        '/proxy/ticket/customer/{ticketId}': {
          put: {
            tags: ['Proxy CRM'],
            summary: 'Atualizar ticket/customer por ID',
            parameters: [
              {
                name: 'ticketId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'ID do ticket.'
              }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TicketCustomerRequest' }
                }
              }
            },
            responses: {
              200: {
                description: 'Ticket atualizado com sucesso',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericProxySuccess' }
                  }
                }
              },
              400: {
                description: 'Erro de validação',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/GenericError' }
                  }
                }
              }
            }
          }
        }
      }
    },
    apis: []
  });
}
