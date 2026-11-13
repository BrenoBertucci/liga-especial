# Liga Especial

Sistema web que calcula a mistura de materiais de menor custo para produzir uma liga, dentro dos limites de composição definidos pelo usuário. Esta é a versão de rascunho.

- Backend: Python, FastAPI, SQLAlchemy e PostgreSQL. O cálculo usa programação linear (`scipy.optimize.linprog`, método HiGHS).
- Frontend: React, TypeScript e Vite. Funciona no celular, no tablet e no computador, com tema claro e escuro.

## Como rodar

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

Não precisa iniciar a API aqui: o `npm run dev` do frontend já sobe ela. Para rodar só a API, use `uvicorn main:app --reload`.

A conexão padrão é `postgresql+psycopg://postgres@localhost:5432/liga_especial`, com a senha lida do `pgpass.conf`. Para outro usuário ou senha, defina `DATABASE_URL` antes de iniciar:

```bash
set DATABASE_URL=postgresql+psycopg://postgres:SUA_SENHA@localhost:5432/liga_especial
```

A API só responde quando é chamada por `localhost` ou `127.0.0.1`, o que barra ataques de DNS rebinding. Para publicar em outro endereço, inclua o domínio em `ALLOWED_HOSTS` (separado por vírgula):

```bash
set ALLOWED_HOSTS=localhost,127.0.0.1,liga.exemplo.com.br
```

Na primeira execução, o backend cria as tabelas e cadastra os dados da planilha `Liga_Especial_Solver.xlsx`: 4 atributos, 6 materiais e a fórmula "Liga padrão".

- Documentação da API: http://localhost:8000/docs
- Teste do cálculo, sem banco: `python test_solver.py`

### 3. Frontend (pasta `frontend/`)

```bash
npm install
npm run dev
```

O `npm run dev` sobe a API (porta 8000) e o site (porta 5181) no mesmo terminal, e o Ctrl+C para os dois. Se a API já estiver aberta em outro terminal, o site usa essa.

Acesse http://localhost:5181. As chamadas para `/api` são repassadas ao backend na porta 8000.

## Publicar (grátis)

| Parte | Onde | Como |
| --- | --- | --- |
| Banco | Supabase | Projeto na região East US (North Virginia). Copie a conexão "Session pooler" (botão Connect). |
| API | Render | New → Blueprint, usando o `render.yaml`. Em `DATABASE_URL`, cole a conexão do Supabase com a senha. |
| Site | Vercel | Importe o repositório com Root Directory `frontend`. O `vercel.json` repassa `/api` para a API no Render. |

- A API aceita o endereço público do Render sozinha, e a conexão `postgresql://` do Supabase funciona como vem.
- Se o Render der outro endereço ao serviço (o nome já existir), troque o destino do `/api` em `frontend/vercel.json`.
- No plano grátis, o Render desliga a API depois de 15 minutos sem acesso, e a primeira chamada depois disso leva de 30 a 60 s. O Supabase pausa o projeto depois de 1 semana sem uso; ele volta pelo painel.
- A API não tem login: com o site no ar, qualquer pessoa com o endereço consegue alterar os dados.

## API

| Método e caminho | O que faz |
| --- | --- |
| `GET/POST /api/attributes`, `PUT/DELETE /api/attributes/{id}` | Atributos técnicos (nome e unidade) |
| `GET/POST /api/materials`, `GET/PUT/DELETE /api/materials/{id}` | Materiais, com preço por kg e valor de cada atributo |
| `GET/POST /api/formulas`, `GET/PUT/DELETE /api/formulas/{id}` | Fórmulas salvas: materiais, inclusões, limites e lote |
| `POST /api/calculations` | Calcula a composição de menor custo |

Os erros seguem o formato `{"error": {"code", "message", "details"}}`: 404 (não encontrado), 409 (nome repetido ou material em uso) e 422 (dados inválidos).
Quando não existe mistura possível, a resposta é 200 com `status: "no_solution"`, uma mensagem e sugestões de quais limites rever.

## Regras do cálculo

- Cada material tem um preço por kg e um valor para cada atributo, como o teor de ferro ou de carbono.
- O valor de um atributo na mistura é a média dos materiais, ponderada pela massa de cada um.
- O lote pode ser informado em kg ou em t.
- Se a fórmula limita um atributo, todos os materiais escolhidos precisam ter valor para ele.
- A fórmula salva guarda materiais, limites e lote. O resultado é recalculado ao abrir, com os preços atuais.
- Um material usado em alguma fórmula não pode ser excluído.

## Próximas etapas

Login, migrações de banco com Alembic, mais testes, histórico de preços e outras unidades além de kg e t.
