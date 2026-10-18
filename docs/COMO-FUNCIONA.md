# Como funciona

Um guia do código, para quem vai mantê-lo ou revisá-lo.

```
github-pulse@joaocarvalhosm.github.io/
├── extension.js     liga tudo: timer, busca, cache e o indicador
├── prefs.js         janela de configurações (token e intervalo)
├── stylesheet.css   aparência do menu e da barra
├── lib/             lógica sem interface (testada com make test)
│   ├── api.js       consulta GraphQL, erros HTTP, conversão e validação
│   ├── token.js     token no chaveiro (libsecret)
│   ├── cache.js     última resposta em ~/.cache/github-pulse/
│   ├── urls.js      validação dos endereços vindos da API
│   ├── stats.js     sequências, médias, últimos dias, "há X min"
│   ├── format.js    textos do menu em português
│   ├── grid.js      geometria da grade do ano e qual dia está sob o mouse
│   └── palette.js   cores dos níveis no estilo claro e escuro
└── ui/              widgets do GNOME Shell
    ├── indicator.js botão da barra e o menu
    └── heatmap.js   grade do ano e legenda, desenhadas com Cairo
tests/
├── run.js           executa todos os *.test.js
├── harness.js       test(), eq(), throws(), fixture()
├── *.test.js        um arquivo por módulo de lib/
├── smoke.sh         liga e desliga a extensão num GNOME Shell sem tela
└── fixtures/        resposta de exemplo da API
```

A regra é: **o que pode ser testado sem o GNOME Shell fica em `lib/`**, e
`ui/` só monta widgets com o que `lib/` calcula.

## Fluxo de uma atualização

1. `extension.js` lê o token do chaveiro (`lookupToken`). Sem token, o menu
   pede para conectar a conta e o cache é apagado.
2. `GitHubClient.fetchPulse` faz **uma** requisição `POST` para
   `https://api.github.com/graphql` com a consulta `QUERY`. Ela traz o
   calendário do último ano, os totais, as contribuições por repositório e
   os repositórios com push mais recente.
3. `errorForStatus` transforma o status HTTP num erro com tipo, e
   `viewerFromResponse` trata os erros do GraphQL.
4. `parseViewer` transforma a resposta num objeto simples (`pulse`, com
   `version`), que é o único formato que a interface conhece.
5. A foto é baixada só quando a URL muda, e só de
   `avatars.githubusercontent.com`.
6. O `pulse` vai para o cache e para `PulseIndicator.update()`.

Quando algo falha, o último `pulse` continua na tela e o menu explica o
motivo. O tipo do erro (`GitHubError.kind`) decide o ícone e a ação do
aviso:

| `kind` | Causa | Clicar no aviso |
|---|---|---|
| `auth` | token recusado, sem permissão ou expirado | abre as configurações |
| `rate` | limite de uso da API | tenta de novo |
| `network` | sem conexão | tenta de novo |
| `api` | resposta inesperada ou redirecionamento | tenta de novo |

## Quando atualiza

- Ao ativar a extensão: primeiro mostra o cache, depois busca.
- A cada `refresh-minutes` (padrão 15).
- Ao abrir o menu, se os dados tiverem mais de 5 min.
- Quando as configurações mudam o token: `prefs.js` incrementa
  `token-revision`, e a extensão reage a essa mudança. O token em si nunca
  passa pelo GSettings.

Só uma busca roda por vez (`_refreshing`). `disable()` cancela a busca em
andamento pelo `Gio.Cancellable`, remove o timer, desconecta os sinais e
destrói o indicador. Depois de cada `await`, o código confere se foi
cancelado antes de mexer na interface.

## O menu (`ui/indicator.js`)

De cima para baixo: cabeçalho (foto, nome, atualização e botões), aviso
(só quando falta algo ou algo falhou), quatro números, grade do ano, resumo
do ano e repositórios recentes. O cabeçalho e o aviso ficam fora de
`this._data`, que some inteiro quando não há dados.

Os botões usam a classe `icon-button` do próprio Shell, para seguir o
visual do GNOME. As cores secundárias usam cinza com transparência, que
funciona no estilo claro e no escuro.

> **Cuidado ao guardar widgets em outros widgets.** `column.name = label`
> parece inofensivo, mas `name` já é uma propriedade de todo
> `Clutter.Actor` e só aceita texto. Isso derrubou a ativação com
> "Promise callback terminated with uncatchable exception" e travou as
> extensões seguintes. Use nomes que não existam no Clutter/St, como
> `valueLabel` e `dayLabel`. O `make smoke` pega esse tipo de erro.

## Grade do ano (`lib/grid.js` e `ui/heatmap.js`)

São cerca de 370 quadrados de 10 px com 3 px de espaço, como no GitHub,
desenhados num único `St.DrawingArea` com Cairo, o que é mais leve que um
widget por dia.

- `layoutGrid(days)` calcula a posição de cada dia: a coluna é a semana e a
  linha é o dia da semana (domingo em cima). Calcula também onde vão os
  nomes dos meses (um mês com poucos dias no início é omitido para não
  encostar no seguinte) e "Seg", "Qua" e "Sex" à esquerda.
- `cellAt(layout, x, y)` converte a posição do mouse no dia, ou `-1`.
- `heatmap.js` só desenha: os textos com PangoCairo na fonte do tema, e os
  quadrados com as cores de `palette.js`.

## Cores (`lib/palette.js`)

Os níveis 1 a 4 usam as escalas de verde do próprio GitHub, uma para o
estilo escuro e outra para o claro. A escolha vem da cor do texto do tema:
texto claro significa estilo escuro. O nível 0 é a cor do texto com pouca
opacidade, então combina com qualquer fundo. Na barra, as cores vêm do
`stylesheet.css` (classes `github-pulse-l0` a `l4`).

## Cálculos (`lib/stats.js`)

- **Sequência atual:** dias seguidos com contribuição até hoje. Um dia de
  hoje ainda vazio não quebra a sequência, que é contada a partir de ontem.
- **Recorde:** a maior sequência no calendário. Dias que faltam contam como
  interrupção.
- **Dia mais ativo:** a maior **média** por dia da semana, para não
  favorecer o dia que aparece mais vezes no período.
- **Linguagens:** a linguagem principal de cada repositório onde você fez
  commits, com peso pelo número de commits.

## Segurança

- **Token:** só no chaveiro (`lib/token.js`). A janela de configurações
  confere o formato (`github_pat_…` ou `ghp_…`, sem espaços nem quebras de
  linha, o que impede injetar cabeçalhos HTTP) e testa o token no GitHub
  **antes** de salvar.
- **Requisições:** o token só vai para o endereço fixo da API, com
  `Soup.MessageFlags.NO_REDIRECT`. Um redirecionamento vira erro `api` em
  vez de levar o token para outro lugar. O download da foto também não
  segue redirecionamentos, não leva o token, aceita só imagens até 1 MiB e
  grava com permissão `600`.
- **Endereços:** `lib/urls.js` aceita apenas HTTPS, no host exato, sem
  usuário e sem porta. Assim, um link malformado na resposta não abre outro
  site nem baixa nada de fora.
- **CSS:** dados da API só entram em estilos depois de `safeColor`, que
  aceita apenas `#rrggbb`. Os textos vão para `St.Label` como texto puro,
  sem markup.
- **Cache:** criado com `Gio.FileCreateFlags.PRIVATE`, com o modo reforçado
  para `600`, porque guarda nomes de repositórios privados. Na leitura,
  `isValidPulse` confere o formato e a versão, e o caminho da foto é
  recalculado em vez de vir do arquivo.
