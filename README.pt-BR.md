# GitHub Pulse

[English](README.md) | **Português**

**Sua atividade no GitHub na barra do GNOME.**

A barra mostra os últimos 7 dias em quadradinhos, como no gráfico de
contribuições do GitHub. Clicando, aparecem a grade do ano, as sequências, o
resumo do ano e os seus repositórios mais recentes.

![Menu no estilo escuro](docs/screenshots/menu-escuro.png)

| Estilo claro | Na barra |
|---|---|
| ![Menu no estilo claro](docs/screenshots/menu-claro.png) | ![Últimos 7 dias na barra](docs/screenshots/barra.png) |

*Capturas feitas com uma conta de demonstração.*

| | |
|---|---|
| **GNOME Shell** | 50 |
| **Versão** | 0.1.0, veja o [CHANGELOG](CHANGELOG.md) |
| **Licença** | GPL-3.0-or-later |
| **Idioma da interface** | português do Brasil |

## O que mostra

- **Na barra:** os últimos 7 dias, o mais antigo à esquerda e hoje à direita,
  na escala de verdes do GitHub.
- **No menu:**
  - **cabeçalho:** foto, nome, quando os dados foram atualizados e três
    botões: atualizar, abrir o perfil no GitHub e configurações;
  - **quatro números:** contribuições no último ano, sequência atual,
    recorde e contribuições de hoje;
  - **grade do ano:** semanas em colunas (domingo em cima), meses no topo e
    legenda "Menos … Mais". Passe o mouse para ver o dia e a quantidade;
  - **resumo do ano:** commits, pull requests, issues e revisões; o dia da
    semana em que você mais contribui; e as linguagens dos repositórios onde
    fez commits;
  - **repositórios recentes:** os que receberam push por último, com a cor
    da linguagem, um cadeado se forem privados, estrelas, issues e PRs
    abertos e quando foi o último push. Clicando, abre no navegador.
- **Sem internet:** continua mostrando os últimos dados salvos e avisa o
  motivo.
- **Estilos claro e escuro:** as cores acompanham o estilo do GNOME.

## Instalação

```bash
git clone https://github.com/joaocarvalhosm/github-pulse.git
cd github-pulse
make install
```

Saia e entre de novo na sessão. Se a extensão não aparecer, ative com
`gnome-extensions enable github-pulse@joaocarvalhosm.github.io`.

## Conectar a conta

1. Crie um token **fine-grained** em
   <https://github.com/settings/personal-access-tokens/new>:
   - **Expiration:** um prazo, por exemplo 90 dias;
   - **Repository access:** *All repositories*, ou só os que você quer ver;
   - **Permissions:** não adicione nenhuma. O padrão (*Metadata: read-only*)
     basta.
2. No menu, clique no botão de configurações (⚙), cole o token em **Novo
   token** e confirme.
3. A extensão confere o token no GitHub antes de salvar e mostra
   "Conectado como @você".

Quando o token expirar, o menu avisa. Crie outro e cole no mesmo lugar.

## Configurações

| Opção | Padrão | Faixa |
|---|---|---|
| Atualizar a cada | 15 min | 5 a 240 min |
| Repositórios recentes no menu | 6 | 1 a 15 |

Além do intervalo, a extensão atualiza ao abrir o menu se os dados tiverem
mais de 5 minutos, e na hora em que o token muda.

## Segurança e privacidade

O que a extensão garante, e como:

| Garantia | Como |
|---|---|
| O token fica só no **chaveiro do GNOME** | Guardado com libsecret, criptografado e liberado com a sua sessão. Não vai para o GSettings, para arquivos, para o log nem para mensagens de erro, e não é mostrado de novo depois de salvo. |
| O token só vai para `api.github.com` | É enviado apenas na consulta ao endereço fixo da API, por HTTPS, e **redirecionamentos não são seguidos**, então ele não é repassado a outro servidor. |
| A extensão **só lê** | A consulta GraphQL é só de leitura (há um teste que garante que não existe `mutation`). Com um token sem permissões de escrita, nada na sua conta pode ser alterado, nem por engano. |
| Nada de fora entra no CSS ou no navegador | Cores de linguagens só passam se forem `#rrggbb`. Links só abrem se forem `https://github.com/…`, sem usuário nem porta. A foto só vem de `https://avatars.githubusercontent.com`, até 1 MiB e apenas PNG, JPEG, GIF ou WebP. |
| O cache é só seu | `~/.cache/github-pulse/` tem a pasta com permissão `700` e os arquivos com `600`, porque podem conter nomes de repositórios privados. Remover o token apaga o cache. |
| Um cache estragado não quebra nada | O arquivo é validado ao ser lido. Se estiver em outro formato ou danificado, é ignorado e os dados são buscados de novo. A foto é sempre o arquivo da própria extensão, e não um caminho vindo do cache. |
| Os erros do GitHub não poluem a tela | As mensagens são curtas (até 200 caracteres) e nunca incluem o token. |
| Sem telemetria | Nenhum dado vai para outro lugar além do GitHub. |
| Nada na tela de bloqueio | A extensão é desligada quando a tela é bloqueada, como o GNOME faz por padrão. |

Para relatar uma falha de segurança, veja o [SECURITY.md](SECURITY.md).

## Solução de problemas

- **"O GitHub recusou o token":** o token expirou ou foi revogado. Crie
  outro e cole nas configurações.
- **"Limite de uso da API":** espere alguns minutos. A extensão faz uma
  única consulta por atualização.
- **O menu não aparece ou outras extensões sumiram:** o GNOME liga as
  extensões uma de cada vez. Se uma travar, as seguintes (a dock, por
  exemplo) não carregam. Desative esta com
  `gnome-extensions disable github-pulse@joaocarvalhosm.github.io`, saia e
  entre de novo, e abra uma issue com a saída de
  `journalctl --user -b -o cat | grep -iE "github-pulse|JS ERROR|uncatchable"`.

## Desenvolvimento

```bash
make test    # testes unitários (gjs, sem precisar do GNOME Shell)
make smoke   # liga e desliga a extensão num GNOME Shell sem tela, isolado
make check   # os dois
make pack    # gera dist/…shell-extension.zip só com o necessário
make install # instala o zip para o seu usuário
```

- **Testes unitários** (`tests/*.test.js`): cálculos, textos, geometria da
  grade, cores, conversão e validação da resposta, erros HTTP, URLs, formato
  do token e cache (numa pasta temporária, nunca no seu `~/.cache`).
- **Smoke test** (`tests/smoke.sh`): roda um GNOME Shell `--headless` numa
  sessão D-Bus própria e com um `HOME` temporário, sem acesso ao seu
  chaveiro, às suas configurações nem ao seu cache. Ele confere que a
  extensão fica ativa, desliga e liga de novo sem erros de JavaScript. Ele
  pega o tipo de erro que só aparece dentro do Shell, como o que travou a
  0.1.0 durante o desenvolvimento.
- O pacote leva só os arquivos da extensão, sem testes nem scripts, como pede
  a revisão do extensions.gnome.org.
- Como cada parte funciona: [docs/HOW-IT-WORKS.pt-BR.md](docs/HOW-IT-WORKS.pt-BR.md).

## Créditos

Este é um projeto independente, sem vínculo com o GitHub. "GitHub" é uma
marca da GitHub, Inc. e aparece aqui só para dizer com qual serviço a
extensão funciona. O ícone é original, e a escala de verdes reproduz as
cores do gráfico de contribuições.
