# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [0.1.0] - 2026-10-17
### Adicionado
- Últimos 7 dias de contribuições na barra, em quadrados como no GitHub.
- Menu com:
  - cabeçalho com foto, nome, hora da última atualização e botões para
    atualizar, abrir o perfil e abrir as configurações;
  - contribuições no último ano, sequência atual, recorde e contribuições
    de hoje;
  - grade do ano no tamanho do GitHub, com meses, dias da semana, legenda e
    o dia sob o mouse;
  - resumo do ano (totais, dia mais ativo e linguagens);
  - repositórios com push recente.
- Estilos claro e escuro.
- Token guardado no chaveiro do GNOME, conferido no GitHub antes de salvar.
- Cache da última resposta, com permissões só do dono e validado na
  leitura, para o login e para quando estiver sem internet.
- Atualização a cada 15 min (configurável) e ao abrir o menu se os dados
  tiverem mais de 5 min.
- Testes unitários de todos os módulos de `lib/` e um smoke test num GNOME
  Shell sem tela (`make check`).

### Segurança
- O token não segue redirecionamentos e só vai para `api.github.com`.
- A foto só é aceita como imagem pequena (até 1 MiB) de
  `avatars.githubusercontent.com`.
- As cores vindas da API só entram no CSS no formato `#rrggbb`.
