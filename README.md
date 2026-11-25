# Liga Especial

Sistema web que calcula a mistura de materiais de menor custo para produzir uma liga metálica dentro da composição desejada. O cálculo é um problema de programação linear, resolvido pelo otimizador HiGHS.

**Site no ar:** https://liga-especial.vercel.app

- **Instituição:** Faculdade de Tecnologia de Mococa – Mário Robertson de Sylos Filho
- **Trabalho:** trabalho final de aplicação prática de Programação Linear, 2º semestre de 2026
- **Disciplina:** Programação Linear e Aplicações
- **Professor:** Washington Luis Moreira Braga
- **Alunos:** Breno Bertucci, Gabriel Spalato e Victor Cintra

## Sumário

1. [Visão geral](#visão-geral)
2. [O modelo de programação linear](#o-modelo-de-programação-linear)
3. [Como o projeto foi construído](#como-o-projeto-foi-construído)
4. [Guia do usuário](#guia-do-usuário)
5. [Como rodar no computador](#como-rodar-no-computador)
6. [API](#api)
7. [Segurança e desempenho](#segurança-e-desempenho)
8. [Regras do cálculo](#regras-do-cálculo)
9. [Próximas etapas](#próximas-etapas)

## Visão geral

O usuário cadastra os materiais que tem à disposição, com o preço por kg e a composição de cada um. Depois informa a faixa aceitável de cada elemento na liga pronta e o tamanho do lote. O sistema responde quanto usar de cada material para gastar o mínimo sem sair da especificação.

![Tela inicial do sistema, com o menu lateral e os atalhos para materiais, atributos e fórmulas](docs/img/figura-1-inicio.jpg)

*Figura 1 – Tela inicial: acesso aos materiais, atributos e fórmulas.*

| Parte | O que faz |
| --- | --- |
| Frontend (as telas) | É o que a pessoa vê e usa: menus, campos, botões e resultados. |
| Backend (o processamento) | Confere o acesso e os dados, recebe os pedidos e calcula a mistura. |
| Banco de dados (os registros) | Guarda contas, materiais, preços, atributos e fórmulas salvas. |

Caminho de uso: entrar na conta → conferir os materiais → criar uma fórmula → calcular → salvar e consultar depois.

## O modelo de programação linear

Toda conta nova recebe o exemplo da planilha `Liga_Especial_Solver.xlsx`: seis materiais e quatro elementos controlados.

| Material | Preço (R$/kg) | Ferro | Carbono | Silício | Níquel |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ferro puro | 0,30 | 100% | 0% | 0% | 0% |
| Carbono (grafite) | 0,20 | 0% | 100% | 0% | 0% |
| Silício metálico | 0,28 | 0% | 0% | 100% | 0% |
| Níquel eletrolítico | 0,50 | 0% | 0% | 0% | 100% |
| Sucata reciclada A | 0,20 | 60% | 20% | 20% | 0% |
| Sucata reciclada B | 0,25 | 70% | 20% | 5% | 5% |

A variável `xj` é a fração do lote feita com o material j: x1 ferro puro, x2 carbono, x3 silício, x4 níquel, x5 sucata A e x6 sucata B. Como as frações somam 1, o teor de um elemento na liga é a média dos teores dos materiais, ponderada por essas frações.

```text
Minimizar  Z = 0,30x1 + 0,20x2 + 0,28x3 + 0,50x4 + 0,20x5 + 0,25x6     (R$ por kg de liga)

Sujeito a
   x1 + x2 + x3 + x4 + x5 + x6 = 1                (as frações formam o lote inteiro)
   60 ≤ 100x1 + 60x5 + 70x6 ≤ 65                  (Ferro, %)
   15 ≤ 100x2 + 20x5 + 20x6 ≤ 20                  (Carbono, %)
   15 ≤ 100x3 + 20x5 +  5x6 ≤ 20                  (Silício, %)
    5 ≤ 100x4 +  5x6        ≤  8                  (Níquel, %)
   0 ≤ xj ≤ 1,  j = 1, ..., 6                     (inclusão mínima e máxima de cada material)
```

### Solução ótima

O HiGHS chega a x1 = 0,075, x4 = 0,05 e x5 = 0,875, com os outros materiais em zero.

- Custo: Z = 0,30 × 0,075 + 0,50 × 0,05 + 0,20 × 0,875 = R$ 0,2225 por kg, ou R$ 222,50 num lote de 1.000 kg.
- Conferência: Ferro = 100 × 0,075 + 60 × 0,875 = 60%; Carbono = 20 × 0,875 = 17,5%; Silício = 20 × 0,875 = 17,5%; Níquel = 100 × 0,05 = 5%.

A sucata A custa R$ 0,20 por kg e, sozinha, já fica dentro das faixas de Ferro, Carbono e Silício, mas não tem Níquel. Os 5% de níquel eletrolítico cobrem essa falta e diluem o ferro para 57%, e os 7,5% de ferro puro trazem o teor de volta a 60%. Ferro e Níquel terminam no mínimo permitido: são as restrições ativas, e afrouxar qualquer uma delas baixaria o custo.

### Sem solução possível

Nos seis materiais, Ferro + Carbono + Silício + Níquel somam 100%, então a liga pronta também soma 100%. Pedir pelo menos 90% de Ferro e manter os mínimos de 15% + 15% + 5% dos outros exigiria 125%. Nenhuma mistura atende a essas restrições ao mesmo tempo. O HiGHS devolve o status 2 (problema inviável), e o sistema mostra o aviso com sugestões de limites para rever.

### No código

A função `linprog` só aceita restrições do tipo "menor ou igual", então cada limite mínimo entra com o sinal trocado (−a·x ≤ −mín). A inclusão mínima e máxima de cada material vira o intervalo da variável (`bounds`).

```python
# backend/solver.py
def _resolver(precos, faixas, linhas):
    """Frações de menor custo que somam 1, ou None se não houver. linhas: (coeficientes, mín, máx)."""
    a_ub, b_ub = [], []
    for coef, minimo, maximo in linhas:
        if maximo is not None:
            a_ub.append(coef)
            b_ub.append(maximo)
        if minimo is not None:
            a_ub.append([-c for c in coef])
            b_ub.append(-minimo)
    r = linprog(precos, A_ub=a_ub or None, b_ub=b_ub or None, A_eq=[[1.0] * len(precos)], b_eq=[1.0],
                bounds=faixas, method="highs")
    if r.status == 2:
        return None
    if r.status != 0:
        raise RuntimeError(f"O otimizador parou sem resposta: {r.message}")
    # float() tira o tipo do NumPy, que o JSON da API não serializa
    return [max(0.0, float(v)) for v in r.x]
```

## Como o projeto foi construído

O projeto tem três partes: as telas que o usuário usa, o processamento dos pedidos e o armazenamento das informações.

### Frontend

As telas usam React 19 e TypeScript. O React organiza a interface em componentes (formulários, menus, cartões de resultado), e o TypeScript aponta erros de tipo antes de o código rodar. O CSS cuida das cores, dos temas claro e escuro e da adaptação ao celular. O Vite roda o frontend durante o desenvolvimento e gera os arquivos de publicação.

### Backend

O backend roda em Python com FastAPI, que cria a API REST, o canal pelo qual as telas enviam pedidos e recebem respostas. A API cuida do cadastro e do login, valida os dados com Pydantic e faz as operações de criar, consultar, editar e excluir. Para achar a mistura de menor custo, ela usa a biblioteca SciPy com o otimizador HiGHS.

### Banco de dados

O banco é o PostgreSQL, que guarda as informações em tabelas: contas, sessões, atributos, materiais e fórmulas. O backend acessa o banco pelo SQLAlchemy, com o driver psycopg.

### Hospedagem

O site e a API são dois projetos na Vercel, e o banco fica no Supabase. O site repassa para a API tudo o que começa com `/api`, então o navegador só conversa com um endereço.

### Como as três partes se comunicam

```mermaid
flowchart LR
    U[Usuário] --> F["Frontend<br/>React + TypeScript"]
    F -- "HTTP + JSON em /api" --> B["Backend<br/>FastAPI"]
    B -- SQL --> D[("PostgreSQL")]
    B -- "modelo de PL" --> H["HiGHS<br/>SciPy"]
```

Ao salvar uma fórmula, a tela envia os dados à API por HTTP, em JSON. O backend confere as informações, grava a fórmula no PostgreSQL e devolve uma confirmação, e a tela mostra **Fórmula salva.** O cálculo segue o mesmo caminho, com uma etapa a mais: o backend monta o modelo e chama o otimizador.

Primeiro, a tela faz o pedido. Toda chamada à API passa por uma única função, que envia o JSON e transforma a resposta de erro em mensagem para a tela:

```ts
// frontend/src/api.ts (trecho)
async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch (causa) {
    throw new ErroApi('Sem conexão com o servidor. Tente de novo em instantes.', [], 0, { cause: causa });
  }
  // ...
  const dados = await r.json().catch(() => null);
  if (!r.ok) {
    const e = dados?.error;
    // ...
    throw new ErroApi(e?.message ?? `A API respondeu ${r.status}.`, detalhes, r.status);
  }
  return dados as T;
}
```

Na API, o Pydantic confere o formato antes de qualquer cálculo e recusa lote zero ou negativo, unidade diferente de kg ou t e campo faltando:

```python
# backend/schemas.py
class CalculationIn(Orm):
    batch_size: float = Field(1000, gt=0, le=1_000_000_000)
    batch_unit: Literal["kg", "t"] = "kg"
    items: list[ItemIn]
    limits: list[LimitIn] = []
```

Depois, a rota busca os materiais e atributos do usuário logado (só os dele) e chama o otimizador:

```python
# backend/main.py
@app.post("/api/calculations")
def calcular(body: CalculationIn, u: User = Depends(usuario_atual), db: Session = Depends(get_db)):
    """Composição de menor custo. Sem solução também é 200: status "no_solution", mensagem e dicas."""
    erros, materiais, atributos = problemas_da_formula(db, body, u)
    if erros:
        falha(422, "INVALID_FORMULA", "A fórmula tem problemas.", [{"field": "", "issue": e} for e in erros])
    todos = {a.id: {"name": a.name, "unit": a.unit}
             for a in db.scalars(select(Attribute).where(Attribute.user_id == u.id).order_by(Attribute.name))}
    itens = [{
        "id": m.id, "name": m.name, "price": m.price_per_kg, "min_pct": i.min_pct, "max_pct": i.max_pct,
        "values": {v.attribute_id: v.value for v in m.values},
    } for i in body.items for m in [materiais[i.material_id]]]
    limites = [{"attribute_id": l.attribute_id, "min": l.min_value, "max": l.max_value} for l in body.limits]
    return solver.compor_cacheado(itens, limites, todos, body.batch_size, body.batch_unit)
```

No banco, cada cadastro tem dono (`user_id`), e o nome só precisa ser único dentro da mesma conta:

```python
# backend/db.py
class Material(Base):
    __tablename__ = "materials"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_materials_user_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = dono()   # ForeignKey("users.id", ondelete="CASCADE")
    name: Mapped[str] = mapped_column(String(120))
    price_per_kg: Mapped[float] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    # ...
```

Se alguém pede, pelo id, um cadastro de outra conta, a API responde 404, igual à resposta para um id inexistente. Assim um usuário não descobre quais ids existem nas outras contas:

```python
# backend/main.py
def buscar(db: Session, modelo, id_: int, rotulo: str, u: User):
    obj = db.get(modelo, id_) if 0 < id_ <= MAX_ID else None
    if obj is None or obj.user_id != u.id:
        falha(404, "NOT_FOUND", f"{rotulo} {id_} não existe.")
    return obj
```

## Guia do usuário

Os prints abaixo mostram o sistema em funcionamento, na versão de 18/11/2026, com os dados de demonstração.

### 1. Acesse sua conta

Abra https://liga-especial.vercel.app. Se o sistema estiver rodando no seu computador, use http://localhost:5181.

![Tela de criação de conta, com os campos de e-mail e senha](docs/img/figura-2-criar-conta.jpg)

*Figura 2 – Criar conta: informe o e-mail e uma senha de pelo menos 8 caracteres e clique em Criar conta.*

No primeiro acesso:

1. Clique em **Criar conta**.
2. Informe seu e-mail e uma senha com pelo menos 8 caracteres. O botão **Mostrar** exibe a senha para você conferir o que digitou.
3. Clique no botão **Criar conta**. Você entra direto no sistema.

Cada conta nova recebe exemplos prontos para treinar: 4 atributos, 6 materiais e a fórmula **Liga padrão**.

Se você já tem conta, selecione **Entrar**, informe o e-mail e a senha e clique em **Entrar**. Seus materiais e fórmulas aparecem do jeito que você deixou.

Se não conseguir entrar, confira o e-mail e a senha. A mensagem é a mesma para e-mail sem conta e para senha errada ("E-mail ou senha incorretos."). Depois de 5 senhas erradas em 15 minutos, o sistema bloqueia aquele e-mail por até 15 minutos.

Nos bastidores, o backend confere a senha, abre uma sessão e libera só os dados daquela conta.

### 2. Cadastre os materiais

Um material é um ingrediente da mistura. O cadastro reúne o nome, o preço por kg e a composição.

![Formulário de novo material, com nome, preço por kg e o valor de cada atributo](docs/img/figura-3-novo-material.jpg)

*Figura 3 – Novo material: preencha o preço e o valor de cada atributo.*

Antes de cadastrar, confira os atributos. Em **Atributos** ficam as características que você quer controlar, como Ferro, Carbono, Silício e Níquel. Para criar um, informe o nome e a unidade (por exemplo, %) e clique em **Adicionar**. Para editar, altere os campos da linha e clique em **Salvar**.

Depois, cadastre o material:

1. Abra **Materiais** → **Novo material**.
2. Preencha o nome e o preço por kg.
3. Informe o valor de cada atributo e, se quiser, uma observação.
4. Role até o fim e clique em **Salvar**. A lista de materiais abre com o aviso **Material cadastrado.**

Exemplo: o ferro puro tem 100% de Ferro e 0% de Carbono, Silício e Níquel. Preencher 0 é diferente de deixar em branco: em branco quer dizer que o valor não foi informado, e esse material não entra em fórmula que limita aquele atributo.

Os seis materiais do exemplo já vêm cadastrados. Se quiser, confira os dados e siga para a fórmula.

### 3. Monte uma fórmula

A fórmula diz quais materiais podem entrar na mistura e quais limites a liga pronta precisa atender.

![Tela de nova fórmula, com materiais, limites e resultado lado a lado](docs/img/figura-4-nova-formula.jpg)

*Figura 4 – Nova fórmula: materiais à esquerda, limites no centro e resultado à direita.*

1. Abra **Fórmulas** → **Nova fórmula**.
2. Marque Ferro puro, Carbono (grafite), Silício metálico, Níquel eletrolítico e as sucatas recicladas A e B. Deixe a inclusão de cada um entre 0% e 100%.
3. Informe o lote de 1.000 kg, que é a quantidade total a produzir. A unidade pode ser kg ou t.
4. Preencha os limites abaixo e clique em **Calcular mistura**.

| Atributo | Mínimo | Máximo |
| --- | ---: | ---: |
| Ferro | 60% | 65% |
| Carbono | 15% | 20% |
| Silício | 15% | 20% |
| Níquel | 5% | 8% |

**Inclusão** é a participação de um material na receita. **Limite** é a faixa desejada de um atributo na liga pronta.

Para apresentar sem mexer no exemplo, crie uma fórmula nova com outro nome e deixe a **Liga padrão** como está.

### 4. Calcule e leia o resultado

Ao clicar em **Calcular mistura**, o backend monta o modelo de programação linear e o HiGHS encontra a combinação mais barata que respeita os limites.

<img src="docs/img/figura-5-resultado-celular.jpg" width="300" alt="Resultado do cálculo na tela do celular, com a receita e a composição da liga">

*Figura 5 – Resultado na versão para celular.*

Para um lote de 1.000 kg, a receita é:

- 875 kg de sucata reciclada A
- 75 kg de ferro puro
- 50 kg de níquel eletrolítico

Custo por kg: **R$ 0,2225**. Custo do lote: **R$ 222,50**.

Os outros três materiais ficam com zero, porque não baixariam o custo. A composição final é 60% de Ferro, 17,5% de Carbono, 17,5% de Silício e 5% de Níquel, tudo dentro dos limites.

Se não houver mistura possível, o sistema avisa e sugere quais limites rever. As exigências podem se contradizer: pedir pelo menos 90% de Ferro mantendo os outros mínimos deste exemplo exigiria mais de 100% da liga (veja [Sem solução possível](#sem-solução-possível)). Ajuste os limites ou os materiais e clique em **Calcular mistura** de novo. O cálculo não altera os cadastros.

### 5. Salve e consulte depois

Dê um nome à fórmula e salve para abrir de novo quando quiser.

![Fórmula salva, com a mensagem de confirmação no topo da tela](docs/img/figura-6-formula-salva.jpg)

*Figura 6 – A mensagem Fórmula salva confirma o registro.*

1. No campo **Nome da fórmula**, digite um nome, como "Minha apresentação".
2. Clique em **Salvar fórmula**.
3. Para reabrir, vá em **Fórmulas** e clique no nome salvo.
4. Ao editar uma fórmula que já existe, use **Salvar alterações**.

O banco guarda a configuração da fórmula: materiais escolhidos, inclusões, limites e lote. Fechar o navegador não apaga nada. Ao reabrir, o sistema calcula o resultado de novo com os preços atuais dos materiais.

### No dia a dia

- Para editar, abra o material ou a fórmula, faça a mudança e salve.
- Para excluir, clique em **Excluir** e confirme. Um material usado em alguma fórmula precisa sair dela antes. Excluir um atributo apaga também os valores dele nos materiais e os limites nas fórmulas.
- O botão **Tema claro** / **Tema escuro** troca as cores. O site se adapta ao celular, ao tablet e ao computador.
- Para encerrar, clique em **Sair**.

## Como rodar no computador

Requisitos: Python 3.11+, Node 20+ e PostgreSQL.

### 1. Banco

```bash
createdb -U postgres liga_especial
```

### 2. Backend (pasta `backend/`)

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
```

Não é preciso iniciar a API aqui, porque o `npm run dev` do frontend já faz isso. Para rodar só a API, use `uvicorn main:app --reload`.

A conexão padrão é `postgresql+psycopg://postgres@localhost:5432/liga_especial`, com a senha lida do `pgpass.conf`. Para outro usuário ou senha, defina `DATABASE_URL` antes de iniciar:

```bash
set DATABASE_URL=postgresql+psycopg://postgres:SUA_SENHA@localhost:5432/liga_especial
```

A API só aceita pedidos endereçados a `localhost` ou `127.0.0.1`, o que barra ataques de DNS rebinding. Para publicar em outro endereço, inclua o domínio em `ALLOWED_HOSTS`, separado por vírgula:

```bash
set ALLOWED_HOSTS=localhost,127.0.0.1,liga.exemplo.com.br
```

Na primeira execução, o backend cria as tabelas. Cada conta nova recebe a própria cópia dos dados da planilha `Liga_Especial_Solver.xlsx`: 4 atributos, 6 materiais e a fórmula "Liga padrão".

Banco criado antes das contas de usuário: rode uma vez `migracoes/20261117_contas_por_usuario.sql` (o arquivo `_desfazer` volta atrás). A migração passa os cadastros antigos para um dono que não entra no sistema.

- Documentação interativa da API: http://localhost:8000/docs
- Teste do cálculo, sem banco: `python test_solver.py`

### 3. Frontend (pasta `frontend/`)

```bash
npm install
npm run dev
```

O `npm run dev` inicia a API (porta 8000) e o site (porta 5181) no mesmo terminal, e um Ctrl+C encerra os dois. Se a API já estiver aberta em outro terminal, o site usa a que está aberta.

Acesse http://localhost:5181. O Vite repassa as chamadas para `/api` ao backend na porta 8000.

## API

| Método e caminho | O que faz |
| --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login` | Cria a conta ou entra; a sessão vai num cookie HttpOnly que dura 7 dias |
| `POST /api/auth/logout`, `GET /api/auth/me` | Sai da conta; diz quem está logado |
| `GET/POST /api/attributes`, `PUT/DELETE /api/attributes/{id}` | Atributos técnicos (nome e unidade) |
| `GET/POST /api/materials`, `GET/PUT/DELETE /api/materials/{id}` | Materiais, com preço por kg e valor de cada atributo |
| `GET/POST /api/formulas`, `GET/PUT/DELETE /api/formulas/{id}` | Fórmulas salvas: materiais, inclusões, limites e lote |
| `POST /api/calculations` | Calcula a composição de menor custo |

Fora de `/api/auth`, toda rota pede conta (401 sem ela), e cada conta só vê e altera os próprios atributos, materiais e fórmulas: o id de outra conta responde 404, como se não existisse.

Os erros seguem o formato `{"error": {"code", "message", "details"}}`: 401 (sem conta), 404 (não encontrado), 409 (nome ou e-mail repetido, material em uso), 422 (dados inválidos), 429 (tentativas demais) e 503 (servidor ocupado, com `Retry-After`).

Sem mistura possível, a resposta é 200 com `status: "no_solution"`, uma mensagem e sugestões de quais limites rever.

## Segurança e desempenho

### Segurança

- O backend guarda a senha com argon2id, nos parâmetros mínimos da OWASP. Do token de sessão, o banco guarda só o SHA-256; o token em si fica no cookie do navegador.
- O cookie de sessão é HttpOnly, Secure, SameSite=Strict e vale só no caminho `/api`. Cada entrada gera um token novo.
- E-mail sem conta e senha errada recebem a mesma resposta. Cinco senhas erradas em 15 minutos bloqueiam aquele e-mail, e o cadastro de contas novas tem limite por hora.
- O site manda cabeçalhos de proteção, entre eles uma Content-Security-Policy estrita e `X-Frame-Options`.
- O teste de segurança de 17/11/2026 teve 105 casos (acesso sem login, isolamento entre contas, força bruta, sessão, CSRF, XSS e cabeçalhos), e todos passaram.

```python
# backend/auth.py
def abrir_sessao(db: Session, u: User, resposta: Response):
    # Token novo a cada entrada (nada de reaproveitar sessão de antes: evita fixação de sessão)
    token = secrets.token_urlsafe(32)
    db.execute(delete(UserSession).where(UserSession.user_id == u.id, UserSession.expires_at <= agora()))
    db.add(UserSession(user_id=u.id, token_hash=resumo(token), expires_at=agora() + DURACAO))
    resposta.set_cookie(COOKIE, token, max_age=int(DURACAO.total_seconds()), path="/api",
                        secure=True, httponly=True, samesite="strict")
```

### Desempenho

No site publicado, 100 usuários simulados entraram ao mesmo tempo e cada um fez mais 14 pedidos (listas, aberturas de fórmula e cálculos). Resultado: 1.500 requisições sem nenhum erro, os 100 logins concluídos em 1,3 s e 95% das demais respostas abaixo de 350 ms.

A API aguenta essa carga por causa destes ajustes:

- No Supabase, a API usa o pooler em modo transação (porta 6543), sem pool próprio e sem prepared statements. No computador local, o pool vai até 40 conexões e espera no máximo 10 s por uma.
- A API usa até 100 threads de trabalho. Se o banco estiver ocupado, ela responde 503 com `Retry-After` em vez de travar.
- A checagem de login é uma consulta só, que confere a sessão e já traz o dono.
- O servidor calcula no máximo 4 hashes de senha ao mesmo tempo, para o argon2id não esgotar a memória.
- Cálculos repetidos saem de um cache em memória (`lru_cache`).
- Os arquivos do site têm nome com hash e ficam em cache no navegador por um ano.

## Regras do cálculo

- Cada material tem um preço por kg e um valor para cada atributo, como o teor de ferro ou de carbono.
- O valor de um atributo na mistura é a média dos materiais, ponderada pela massa de cada um.
- O lote aceita kg ou t.
- Se a fórmula limita um atributo, todos os materiais escolhidos precisam ter valor para ele.
- A fórmula salva guarda materiais, limites e lote. Ao abrir, o sistema recalcula o resultado com os preços atuais.
- O sistema não deixa excluir um material usado em alguma fórmula.

## Próximas etapas

Recuperar senha por e-mail, migrações de banco com Alembic, mais testes, histórico de preços e outras unidades além de kg e t.
