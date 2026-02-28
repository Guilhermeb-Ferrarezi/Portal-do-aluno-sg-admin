import React from "react";
const MonacoEditorLazy = React.lazy(() => import("@monaco-editor/react"));

interface MonacoEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  onLanguageChange?: (language: string) => void;
  theme?: "light" | "dark";
  height?: string | number;
  autoHeight?: boolean;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
  showLineNumbers?: boolean;
}

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "plaintext", label: "Texto Simples" },
];

export default function MonacoEditor({
  value,
  onChange,
  language = "javascript",
  onLanguageChange,
  theme = "dark",
  height = "400px",
  autoHeight = false,
  minHeight,
  maxHeight,
  readOnly = false,
  showLineNumbers = true,
}: MonacoEditorProps) {
  const editorRef = React.useRef<any>(null);
  const contentSizeListenerRef = React.useRef<any>(null);
  const [currentLanguage, setCurrentLanguage] = React.useState(language);
  const initialHeight =
    typeof height === "number"
      ? height
      : Number.parseInt(String(height).replace("px", ""), 10) || 400;
  const [contentHeight, setContentHeight] = React.useState(initialHeight);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setCurrentLanguage(newLanguage);
    onLanguageChange?.(newLanguage);
  };

  const handleMount = (editor: any) => {
    editorRef.current = editor;

    if (!autoHeight) return;

    const minH = minHeight ?? initialHeight;
    const maxH = maxHeight ?? 1200;

    const updateHeight = () => {
      const next = Math.min(maxH, Math.max(minH, editor.getContentHeight()));
      setContentHeight(next);
    };

    updateHeight();

    if (contentSizeListenerRef.current) {
      contentSizeListenerRef.current.dispose?.();
    }

    contentSizeListenerRef.current = editor.onDidContentSizeChange(updateHeight);
  };

  React.useEffect(() => {
    return () => {
      contentSizeListenerRef.current?.dispose?.();
    };
  }, []);

  return (
    <div className="monacoEditorContainer">
      <div className="monacoEditorHeader">
        <label className="monacoLanguageLabel">
          Linguagem:
          <select
            className="monacoLanguageSelect"
            value={currentLanguage}
            onChange={handleLanguageChange}
            disabled={readOnly}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden" }}>
        <React.Suspense
          fallback={
            <div
              style={{
                minHeight: autoHeight ? contentHeight : undefined,
                height: autoHeight ? undefined : height,
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: 13,
                background: "var(--card-bg, transparent)",
              }}
            >
              Carregando editor...
            </div>
          }
        >
          <MonacoEditorLazy
            height={autoHeight ? contentHeight : height}
            language={currentLanguage}
            value={value}
            onChange={onChange}
            onMount={handleMount}
            theme={theme === "dark" ? "vs-dark" : "vs-light"}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "Fira Code, Consolas, monospace",
              lineNumbers: showLineNumbers ? "on" : "off",
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              readOnly,
              scrollBeyondLastLine: false,
              scrollbar: autoHeight ? { vertical: "hidden" } : undefined,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </React.Suspense>
      </div>
    </div>
  );
}
