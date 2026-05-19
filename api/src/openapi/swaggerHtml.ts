export function renderSwaggerHtml() {
  return String.raw`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Portal do Aluno API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        background: #0b1120;
        color: #e5e7eb;
      }
      body {
        font-family: Inter, system-ui, sans-serif;
      }
      #swagger-ui {
        min-height: 100vh;
        background: #0b1120;
      }
      .topbar { display: none; }
      .doc-banner {
        padding: 16px 20px;
        background: linear-gradient(135deg, #111827, #0f172a);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        font-family: system-ui, sans-serif;
      }
      .doc-banner h1 { margin: 0; font-size: 20px; }
      .doc-banner p { margin: 6px 0 0; color: #94a3b8; }
      .doc-error {
        margin: 24px;
        padding: 16px;
        border-radius: 16px;
        background: rgba(127, 29, 29, 0.25);
        border: 1px solid rgba(248, 113, 113, 0.35);
        font-family: system-ui, sans-serif;
      }
      .swagger-ui,
      .swagger-ui .wrapper,
      .swagger-ui .scheme-container,
      .swagger-ui .information-container {
        background: #0b1120;
        color: #e5e7eb;
      }
      .swagger-ui .scheme-container {
        box-shadow: none;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 20px 0;
      }
      .swagger-ui .scheme-container .schemes,
      .swagger-ui .scheme-container .servers,
      .swagger-ui .scheme-container .servers-title,
      .swagger-ui .scheme-container label {
        color: #e5e7eb !important;
      }
      .swagger-ui .scheme-container select {
        background: #111827;
        color: #e5e7eb;
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: none;
      }
      .swagger-ui .info .title,
      .swagger-ui .info p,
      .swagger-ui .opblock-tag,
      .swagger-ui .opblock-summary-description,
      .swagger-ui .opblock-summary-path,
      .swagger-ui .response-col_status,
      .swagger-ui .response-col_description,
      .swagger-ui .tab li,
      .swagger-ui label,
      .swagger-ui .parameter__name,
      .swagger-ui .parameter__type,
      .swagger-ui .model-title,
      .swagger-ui .prop-name,
      .swagger-ui .prop-type,
      .swagger-ui .markdown p,
      .swagger-ui section.models h4,
      .swagger-ui section.models h5,
      .swagger-ui .model,
      .swagger-ui .renderedMarkdown {
        color: #e5e7eb !important;
      }
      .swagger-ui .info a,
      .swagger-ui .opblock-tag small,
      .swagger-ui .parameter__name.required span,
      .swagger-ui .response-col_links,
      .swagger-ui .responses-inner h4,
      .swagger-ui .responses-inner h5,
      .swagger-ui .tab li button.tablinks,
      .swagger-ui .btn,
      .swagger-ui .copy-to-clipboard,
      .swagger-ui .authorization__btn,
      .swagger-ui .authorization__btn svg,
      .swagger-ui .dialog-ux .modal-ux-header h3,
      .swagger-ui .dialog-ux .modal-ux-content,
      .swagger-ui .dialog-ux .modal-ux-content p,
      .swagger-ui .dialog-ux .modal-ux-content h4,
      .swagger-ui .dialog-ux .auth-container,
      .swagger-ui .auth-btn-wrapper,
      .swagger-ui .auth-wrapper,
      .swagger-ui .scopes h2,
      .swagger-ui .scope-def {
        color: #e5e7eb !important;
      }
      .swagger-ui .opblock .opblock-section-header,
      .swagger-ui .responses-inner,
      .swagger-ui .model-box,
      .swagger-ui .models,
      .swagger-ui .model-container,
      .swagger-ui .dialog-ux .modal-ux,
      .swagger-ui .dialog-ux .modal-ux-content,
      .swagger-ui .dialog-ux .modal-ux-header,
      .swagger-ui .dialog-ux .modal-ux-inner,
      .swagger-ui .highlight-code,
      .swagger-ui textarea,
      .swagger-ui input[type=text],
      .swagger-ui input[type=password] {
        background: #111827 !important;
        color: #e5e7eb !important;
        border-color: rgba(255,255,255,0.12) !important;
      }
      .swagger-ui .model-toggle:after {
        background: transparent;
      }
      .swagger-ui .opblock {
        box-shadow: none;
      }
    </style>
  </head>
  <body>
    <div class="doc-banner">
      <h1>Portal do Aluno API</h1>
      <p>Swagger protegido pelo token do admin portal salvo no localStorage. A UI aceita JWT de sessão e API tokens emitidos em API Tokens.</p>
    </div>
    <div id="doc-error" class="doc-error" style="display:none;"></div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      (async function () {
        const errorNode = document.getElementById("doc-error");
        const token = window.localStorage.getItem("token");
        const specUrl = window.location.pathname.startsWith("/api/docs")
          ? "/api/docs/openapi.json"
          : "/docs/openapi.json";

        if (!token) {
          errorNode.style.display = "block";
          errorNode.textContent = "Token nao encontrado. Abra a documentacao a partir do admin portal autenticado.";
          return;
        }

        try {
          const response = await fetch(specUrl, {
            headers: { Authorization: "Bearer " + token }
          });

          if (!response.ok) {
            errorNode.style.display = "block";
            errorNode.textContent = "Nao foi possivel carregar o spec (" + response.status + "). Verifique se o usuario atual e admin.";
            return;
          }

          const spec = await response.json();
          window.ui = SwaggerUIBundle({
            dom_id: "#swagger-ui",
            spec,
            persistAuthorization: true,
            requestInterceptor: (request) => {
              request.headers = request.headers || {};
              request.headers.Authorization = "Bearer " + token;
              return request;
            }
          });
        } catch (error) {
          errorNode.style.display = "block";
          errorNode.textContent = "Falha ao inicializar o Swagger UI.";
          console.error(error);
        }
      })();
    </script>
  </body>
</html>`;
}
