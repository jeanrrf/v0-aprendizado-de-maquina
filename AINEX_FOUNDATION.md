# Fundação AINEX

## Escopo desta etapa

Esta etapa prepara o repositório para a integração inicial com NVIDIA, mantendo voz, agentes, memória e MCP fora do escopo.

## Arquitetura atual

- `app/layout.tsx`: shell global, metadados e Analytics.
- `app/page.tsx`: composição da UI, estado local de navegação e nome do modelo ativo recebido da API NVIDIA.
- `components/chat/`: superfícies de chat e navegação da interface.
- `components/ainex/`: elementos visuais AINEX atualmente usados pela UI (`AinexOrb` e `ResonanceField`).
- `app/api/chat/route.ts`: integra a NVIDIA Chat API usando `NVIDIA_API_KEY` e `NVIDIA_MODEL` e devolve o modelo ativo para a UI.
- `components/chat/settings-screen.tsx`: exibe `nvidia/nemotron-3-ultra-550b-a55b` como modelo configurado.
- `components/ui/`: componentes shadcn/ui instalados e reutilizáveis.
- `lib/` e `hooks/`: utilitários e hooks compartilhados.
- Nenhuma camada de servidor, persistência, runtime ou integração AINEX foi adicionada.

## Limpeza realizada

- Removido `components/ainex/neural-console.tsx`, que não tinha consumidores.
- Removido `components/ui/use-toast.ts`, duplicata não referenciada; `hooks/use-toast.ts` permanece como implementação consumida pelo toaster.
- Removido `styles/globals.css`, folha global duplicada e não importada; `app/globals.css` é a única fonte global.
- Corrigidos título, descrição e idioma do layout para refletir a aplicação atual.

## Dependências

- `@google/genai`, `firebase`, `react-markdown` e `remark-gfm` permanecem declaradas no `package.json` e foram sincronizadas no `pnpm-lock.yaml` para que o deploy com `pnpm install --frozen-lockfile` seja reprodutível.
- As demais dependências continuam sustentando os componentes instalados em `components/ui/`.

## Decisões pendentes antes da integração NVIDIA

1. Definir o contrato entre a UI atual e o runtime futuro: transporte, eventos, estados e tratamento de falhas.
2. Definir onde o runtime será executado (servidor, worker ou serviço externo) e como as credenciais serão gerenciadas.
3. Definir requisitos de streaming, cancelamento, timeouts, observabilidade e limites de custo.
4. Definir política de dados e privacidade antes de introduzir memória, voz ou persistência.
5. Validar a API NVIDIA e o modelo-alvo antes de criar dependências ou rotas.

Este arquivo é o registro mestre da fundação e deve ser atualizado junto das próximas mudanças estruturais.

## Estado

A UI existente foi preservada; a migração de runtime ainda não começou.

## Verificação

- TypeScript e build devem ser executados após as mudanças.
- A UI deve ser validada no preview sem alteração visual intencional.

