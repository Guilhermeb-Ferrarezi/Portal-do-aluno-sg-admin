import { SlidingNumber } from 'animate-ui';

/**
 * Exemplo de componente usando a biblioteca animate-ui
 *
 * Componentes disponíveis:
 * - SlidingNumber: Número que desliza com animação
 * - E muitos outros componentes animados
 */

export default function AnimateUIExample() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Exemplo de Animações com animate-ui</h2>

      {/* Exemplo 1: SlidingNumber */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Números Animados (SlidingNumber)</h3>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          <SlidingNumber value={12345} />
        </div>
      </div>

      {/* Você pode usar em estatísticas, contadores, etc */}
      <div style={{ marginBottom: '20px', padding: '10px', background: 'var(--card)', borderRadius: '8px' }}>
        <h3>Caso de Uso: Estatísticas de Alunos</h3>
        <p>Total de Alunos: <SlidingNumber value={42} /></p>
        <p>Exercícios Completos: <SlidingNumber value={128} /></p>
        <p>Taxa de Acerto: <SlidingNumber value={87} />%</p>
      </div>
    </div>
  );
}
