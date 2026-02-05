# Modal & ConfirmDialog - Exemplo de Uso

## 1. Modal Simples

```tsx
import Modal from './Modal';

export default function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Abrir Modal</button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Meu Modal"
        size="md"
      >
        <p>Conteúdo do modal aqui</p>
      </Modal>
    </>
  );
}
```

## 2. Modal com Footer

```tsx
import Modal from './Modal';
import { AnimatedButton } from './animate-ui';

export default function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    // Fazer algo...
    setIsLoading(false);
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Formulário"
      size="md"
      footer={
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <AnimatedButton onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancelar
          </AnimatedButton>
          <AnimatedButton onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar'}
          </AnimatedButton>
        </div>
      }
    >
      <input type="text" placeholder="Seu nome" />
    </Modal>
  );
}
```

## 3. ConfirmDialog (Para Deletar)

```tsx
import ConfirmDialog from './ConfirmDialog';

export default function VideoaulaList() {
  const [deleteTarget, setDeleteTarget] = useState<Videoaula | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await deletarVideoaula(deleteTarget.id);
      setDeleteTarget(null);
      setToastMsg({
        type: 'success',
        msg: `"${deleteTarget.titulo}" foi removida.`,
      });
      await carregarVideoaulas();
    } catch (err) {
      setToastMsg({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Erro ao deletar',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Botão Delete */}
      <button onClick={() => setDeleteTarget(videoaula)}>🗑️ Deletar</button>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Deletar videoaula"
        message={`Tem certeza que deseja deletar a videoaula "${deleteTarget?.titulo}"?`}
        confirmText="Deletar"
        cancelText="Cancelar"
        isLoading={isDeleting}
        isDangerous={true}
      />
    </>
  );
}
```

## 4. Tamanhos Disponíveis

- `sm`: 400px max (para diálogos de confirmação)
- `md`: 550px max (padrão, para formulários normais)
- `lg`: 700px max (para formulários complexos)

## 5. Props do Modal

```tsx
interface ModalProps {
  isOpen: boolean;           // Controla se modal está aberto
  onClose: () => void;       // Callback ao fechar
  title: string;             // Título do modal
  children: React.ReactNode; // Conteúdo
  footer?: React.ReactNode;  // Footer com botões (opcional)
  closeOnEscape?: boolean;   // Fechar com ESC (padrão: true)
  closeOnBackdropClick?: boolean; // Fechar ao clicar fora (padrão: true)
  size?: 'sm' | 'md' | 'lg'; // Tamanho (padrão: 'md')
  className?: string;        // Classes CSS extras
}
```

## 6. Props do ConfirmDialog

```tsx
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;      // (padrão: "Confirmar")
  cancelText?: string;       // (padrão: "Cancelar")
  isLoading?: boolean;       // Desabilita botões e mostra "Processando..."
  isDangerous?: boolean;     // Estilo vermelho para o botão confirm
}
```

## 7. Recursos

✅ Portal (renderiza em document.body)
✅ Overlay com backdrop blur
✅ Centralização com grid place-items-center
✅ Fechar com ESC e click fora
✅ Bloqueia scroll do body
✅ Acessibilidade (role="dialog", aria-modal)
✅ Foco gerenciado (inicia no botão Cancelar)
✅ Animações com framer-motion
✅ Respeita prefers-reduced-motion
✅ Responsivo
✅ Dark mode support

## 8. Instalação no Root (se precisar)

Não precisa! O Modal usa `createPortal` automaticamente para renderizar em `document.body`.
