import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/Dashboard/DashboardLayout";
import {
  FadeInUp,
  AnimatedButton,
  AnimatedToast,
} from "../components/animate-ui";
import "./TrilhaCurso.css";

type Modulo = {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  progresso: number; // porcentagem (0-100)
  topicos: string[];
  exercicios: number;
  exerciciosConcluidos: number;
};

export default function TrilhaCursoPage() {
  const navigate = useNavigate();
  const [toastMsg, setToastMsg] = useState<{type: 'success'|'error'; msg: string} | null>(null);

  // Módulos de exemplo (em produção, viriam da API)
  const modulos: Modulo[] = [
    {
      id: "1",
      numero: 1,
      titulo: "Introdução à Programação",
      descricao: "Conceitos fundamentais de lógica e programação",
      progresso: 100,
      topicos: ["Variáveis", "Tipos de Dados", "Operadores", "Estruturas Condicionais"],
      exercicios: 8,
      exerciciosConcluidos: 8,
    },
    {
      id: "2",
      numero: 2,
      titulo: "Estruturas de Controle",
      descricao: "Laços, condições e fluxo de execução",
      progresso: 100,
      topicos: ["If/Else", "Switch", "While", "For", "Do/While"],
      exercicios: 10,
      exerciciosConcluidos: 10,
    },
    {
      id: "3",
      numero: 3,
      titulo: "Funções e Escopo",
      descricao: "Criação e organização de funções",
      progresso: 85,
      topicos: ["Declaração de Funções", "Parâmetros", "Retorno", "Escopo"],
      exercicios: 12,
      exerciciosConcluidos: 10,
    },
    {
      id: "4",
      numero: 4,
      titulo: "Desenvolvimento Web",
      descricao: "HTML5 e CSS3 Avançado",
      progresso: 75,
      topicos: ["HTML5 Semântico", "CSS Grid", "Flexbox", "Responsivo"],
      exercicios: 15,
      exerciciosConcluidos: 11,
    },
    {
      id: "5",
      numero: 5,
      titulo: "JavaScript Avançado",
      descricao: "Async, Promises e ES6+",
      progresso: 45,
      topicos: ["Arrow Functions", "Promises", "Async/Await", "Destructuring"],
      exercicios: 18,
      exerciciosConcluidos: 8,
    },
    {
      id: "6",
      numero: 6,
      titulo: "Frameworks Frontend",
      descricao: "React e gerenciamento de estado",
      progresso: 20,
      topicos: ["Componentes", "Hooks", "State Management", "Roteamento"],
      exercicios: 20,
      exerciciosConcluidos: 4,
    },
  ];

  // Calcular progresso geral
  const progressoGeral = Math.round(
    modulos.reduce((sum, m) => sum + m.progresso, 0) / modulos.length
  );

  const modulosConcluidos = modulos.filter((m) => m.progresso === 100).length;
  const proximoModulo = modulos.find((m) => m.progresso < 100);

  return (
    <DashboardLayout
      title="Trilha do Curso"
      subtitle="Acompanhe seu progresso através dos módulos"
    >
      <FadeInUp duration={0.28}>
        <div className="trilhaContainer">
          <AnimatedToast
            message={toastMsg?.msg || null}
            type={toastMsg?.type || 'success'}
            duration={3000}
            onClose={() => setToastMsg(null)}
          />
        {/* PROGRESSO GERAL */}
        <div className="trilhaHeader">
          <div className="trilhaProgressCard">
            <div className="progressContent">
              <div className="progressTitle">Progresso Geral</div>
              <div className="progressValue">{progressoGeral}%</div>
              <div className="progressBar">
                <div className="progressFill" style={{ width: `${progressoGeral}%` }} />
              </div>
              <div className="progressStats">
                <span>{modulosConcluidos} de {modulos.length} módulos concluídos</span>
              </div>
            </div>
          </div>

          {proximoModulo && (
            <div className="proximoModuloCard">
              <div className="proximoLabel">PRÓXIMO PASSO</div>
              <div className="proximoTitulo">{proximoModulo.titulo}</div>
              <div className="proximoDescricao">{proximoModulo.descricao}</div>
              <AnimatedButton
                className="proximoBtn"
                onClick={() => navigate("/dashboard/exercicios")}
              >
                Começar Agora →
              </AnimatedButton>
            </div>
          )}
        </div>

        {/* LISTA DE MÓDULOS */}
        <div className="modulosContainer">
          {modulos.map((modulo, i) => (
            <FadeInUp key={modulo.id} delay={i * 0.05}>
            <div className={`moduloCard ${modulo.progresso === 100 ? "concluido" : ""}`}>
              <div className="moduloHeader">
                <div className="moduloNumero">{modulo.numero}</div>
                <div className="moduloInfo">
                  <h3 className="moduloTitulo">{modulo.titulo}</h3>
                  <p className="moduloDescricao">{modulo.descricao}</p>
                </div>
                <div className="moduloBadge">
                  {modulo.progresso === 100 ? (
                    <span className="badgeConcluido">✓ Concluído</span>
                  ) : (
                    <span className="badgeEmProgresso">{modulo.progresso}%</span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="moduloProgressBar">
                <div className="progressBackground">
                  <div
                    className="progressFill"
                    style={{ width: `${modulo.progresso}%` }}
                  />
                </div>
                <span className="progressPercent">{modulo.progresso}% concluído</span>
              </div>

              {/* Tópicos */}
              <div className="moduloTopicos">
                <div className="topicosLabel">Tópicos</div>
                <div className="topicosLista">
                  {modulo.topicos.map((topico, idx) => (
                    <span key={idx} className="topicoBadge">
                      {topico}
                    </span>
                  ))}
                </div>
              </div>

              {/* Estatísticas */}
              <div className="moduloStats">
                <div className="statItem">
                  <span className="statIcon">✍️</span>
                  <span className="statText">
                    {modulo.exerciciosConcluidos}/{modulo.exercicios} exercícios
                  </span>
                </div>
              </div>

              {/* Botão de Ação */}
              <AnimatedButton
                className="moduloBtn"
                onClick={() => navigate("/dashboard/exercicios")}
              >
                {modulo.progresso === 100 ? "Revisar Módulo" : "Continuar Aprendizado"}
              </AnimatedButton>
            </div>
            </FadeInUp>
          ))}
        </div>
        </div>
      </FadeInUp>
    </DashboardLayout>
  );
}
