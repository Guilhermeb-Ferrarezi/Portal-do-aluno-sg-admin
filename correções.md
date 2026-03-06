# Sistema de Cursos - Especificação e Tarefas

Status:
- [ ] Não iniciado
- [~] Em progresso
- [x] Concluído

---

# Correções

- [ ] Adicionar opção de **iniciar módulo**
  - Na criação do usuário
  - Na criação de turmas

---

# Estrutura do Curso

## Criar Curso

### Curso Gratuito
Requisitos:
- [x] Duração (campo `duration_hours` adicionado no formulário e API)
- [x] Nível de dificuldade (campo `level` adicionado no formulário e API)
- Turmas criadas via cadastro
- Preço

### Curso Pago
Requisitos:
- [x] Duração
- [x] Nível de dificuldade
- Foco do curso
- Preço

## Sidebar - Menu Estrutura do Curso
- [x] Dropdown com sub-itens:
  - [x] Criar Estrutura (→ /dashboard/estrutura-curso/cursos)
  - [x] Exercícios (→ /dashboard/exercicios)
  - [x] Turmas (→ /dashboard/turmas)

## API - Endpoints adicionados
- [x] POST /courses (criar curso com duration_hours e level)
- [x] DELETE /courses/:id (deletar curso)
- [x] DELETE /modules/:id (deletar módulo)
- [x] DELETE /phases/:id (deletar fase)

---

# Turmas

## Criar Turma

Interface:
- [ ] Mostrar turmas disponíveis no topo (igual outra tela)

Campos:
- [x] Nome da turma
  - Nome exibido abaixo do nome do usuário

Alterações:
- [x] Comentar campo **tipo**
- [x] Remover **categoria**
- [x] Cursos disponíveis:
  - Apenas cursos gratuitos

Restrições:
- [x] Módulo inicial
  - Apenas **exibir**
  - Não permitir edição

Remover:
- [x] Descrição

---

## Tela "Ver Detalhes"

Remover:
- [x] Exercícios
- [x] Cronograma

Manter:
- [x] Gerenciar alunos
- [x] Deletar turma

---

# Módulos

## Criar Módulo

Regras:
- [x] `index_order` automático

Exemplo:
- Último módulo: `4`
- Novo módulo criado: `5`

Permitir:
- [x] Editar `index_order` posteriormente

---

# Fases

Mesma lógica dos módulos.

Regras:
- [x] `index_order` automático

Semana:
- [x] Não escolher semana na criação
- [x] Editar semana **somente na lista**

---

# Exercícios

## Criar Exercício

Campos:

Alterar:
- [x] `titulo` → **nome_exercicio**
- [x] `descricao` → **pergunta**

Desativado temporariamente:
- [x] Resposta / Gabarito esperado
- [x] Permitir repetição

Dificuldade:
- [x] `normal`
- [x] `lower`
  - exercícios de recuperação

Remover:
- [x] Ordem na criação

---

## Publicação do Exercício

Fluxo:

1. Criar exercício
2. Publicar
3. Redirecionar para tela **Fase, criado da fase exercício**

Na lista:
- [ ] Mostrar exercícios disponíveis
- [ ] Permitir editar **ordem**

Funcionamento:
- Igual **módulos**
- Igual **fases**

---

# Usuários

## Criar Usuário
- [x] Criar usuário

## Gerenciar Usuários
- [x] Listar usuários
- [x] Editar usuários
- [x] Remover usuários

---

# Pendências / Limitações

Itens que precisam de decisão ou mais contexto para serem implementados:

1. **Adicionar opção de "iniciar módulo"** - Precisa de definição de como a UI deve funcionar na criação de usuário e na criação de turma. A tabela `progress_student_phase` (status: 0=Não Iniciado, 1=Em Progresso, 2=Concluído) existe no banco mas não há integração no frontend ainda.

2. **Mostrar turmas disponíveis no topo da tela Criar Turma** - Precisa definir layout (lista paginada? cards?). Pode ser implementado usando `listarTurmas` já existente.

3. **Publicação do Exercício → Redirecionar para tela de Fase** - O fluxo de publicar exercício e redirecionar para a tela da fase com lista de exercícios requer:
   - Criar endpoint para associar exercício a uma fase
   - Criar UI de lista de exercícios por fase com drag-and-drop de ordem
   - Definir a tabela/relação exercise ↔ phase no banco

4. **Preço do curso** - A tabela `course` no banco não tem campo `price`. Precisa de migração para adicionar a coluna.

5. **Foco do curso (Curso Pago)** - Precisa definir o que é "foco do curso" e qual campo/formato no banco.