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

Na primeira execução, o backend cria as tabelas. Cada conta nova recebe a própria cópia dos dados da planilha `Liga_Especial_Solver.xlsx`: 4 atributos, 6 materiais e a fórmula "Liga padrão".

Banco criado antes das contas de usuário: rode uma vez `migracoes/20261117_contas_por_usuario.sql` (o arquivo `_desfazer` volta atrás). Os cadastros que já existiam ficam guardados com um dono que não entra no sistema.

- Documentação da API: http://localhost:8000/docs
- Teste do cálculo, sem banco: `python test_solver.py`

### 3. Frontend (pasta `frontend/`)

```bash
npm install
npm run dev
```

O `npm run dev` sobe a API (porta 8000) e o site (porta 5181) no mesmo terminal, e o Ctrl+C para os dois. Se a API já estiver aberta em outro terminal, o site usa essa.

Acesse http://localhost:5181. As chamadas para `/api` são repassadas ao backend na porta 8000.

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

Os erros seguem o formato `{"error": {"code", "message", "details"}}`: 401 (sem conta), 404 (não encontrado), 409 (nome ou e-mail repetido, material em uso), 422 (dados inválidos) e 429 (tentativas demais).

## Segurança

- Senha guardada com argon2id; o banco tem só o SHA-256 do token de sessão.
- Cookie de sessão HttpOnly, Secure, SameSite=Strict e só no caminho `/api`; token novo a cada entrada.
- Mesma resposta para e-mail sem conta e senha errada; 5 erros seguidos travam aquela conta por 15 minutos.
- Teste completo de segurança (sem login, isolamento entre contas, força bruta, sessão, CSRF, XSS, cabeçalhos) feito em 17/11/2026: 105 de 105 aprovados.
Quando não existe mistura possível, a resposta é 200 com `status: "no_solution"`, uma mensagem e sugestões de quais limites rever.

## Regras do cálculo

- Cada material tem um preço por kg e um valor para cada atributo, como o teor de ferro ou de carbono.
- O valor de um atributo na mistura é a média dos materiais, ponderada pela massa de cada um.
- O lote pode ser informado em kg ou em t.
- Se a fórmula limita um atributo, todos os materiais escolhidos precisam ter valor para ele.
- A fórmula salva guarda materiais, limites e lote. O resultado é recalculado ao abrir, com os preços atuais.
- Um material usado em alguma fórmula não pode ser excluído.

## Próximas etapas

Recuperar senha por e-mail, migrações de banco com Alembic, mais testes, histórico de preços e outras unidades além de kg e t.
