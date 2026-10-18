# Segurança

## Como relatar uma vulnerabilidade

Não abra uma issue pública. Use **Security → Report a vulnerability** neste
repositório no GitHub (relato privado). Descreva o problema, como reproduzir
e o impacto. A resposta deve vir em até 7 dias.

## O que esta extensão promete

- O token do GitHub é guardado apenas no chaveiro do GNOME (libsecret) e
  nunca é gravado em arquivo, no GSettings ou no log.
- As requisições vão só para `https://api.github.com`, sem seguir
  redirecionamentos, e o token não é enviado a nenhum outro endereço.
- A extensão só faz consultas de leitura; não existe nenhuma `mutation`.
- As fotos de perfil vêm só de `https://avatars.githubusercontent.com` e
  só são aceitas como imagens de até 1 MiB.
- Dados vindos da API só entram em estilos (CSS) depois de validados.
- Só são abertos no navegador endereços `https://github.com/…` vindos da
  API, validados antes de abrir.
- O cache em `~/.cache/github-pulse/` tem permissões de dono apenas e nunca
  contém o token.
- Não há telemetria.

Qualquer desvio disso é considerado uma vulnerabilidade.

## Recomendação de uso

Use um token **fine-grained**, sem permissões além do padrão
(*Metadata: read-only*) e com data de expiração.
