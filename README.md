# WebGPU Life 3D

Visualizacao 3D interativa do Jogo da Vida de Conway feita com WebGPU e JavaScript puro.

O projeto renderiza um grid 3D de celulas cubicas com estetica neon/cyberpunk, camera livre, zoom, rotacao automatica e simulacao executada na GPU com compute shaders.

## Recursos

- Grid 3D com dimensoes `X`, `Y` e `Z`.
- Celulas vivas renderizadas como cubos 3D.
- Celulas mortas nao sao renderizadas.
- Simulacao na GPU usando compute shader.
- Buffers ping-pong para atualizar o estado.
- Renderizacao WebGPU com perspectiva e profundidade real.
- Cores RGB neon com brilho e transparencia leve.
- Camera 3D com orbita, pan e zoom.
- Rotacao automatica nos eixos X, Y e Z.
- Play/pause.
- Controle de velocidade.
- Reset aleatorio.
- Alteracao do tamanho do grid.
- Exibicao de FPS e step atual.

## Estrutura

```text
.
├── intdex.html
├── EXPLICACAO_DO_FLUXO.md
└── src
    ├── Camera.js
    ├── Controls.js
    ├── LifeRenderer3D.js
    ├── LifeSimulation3D.js
    ├── main.js
    ├── math.js
    └── shaders
        ├── renderPrepShader.js
        ├── renderShader.js
        └── simulationShader.js
```

## Como Rodar

WebGPU precisa de um contexto seguro. Use `localhost`.

Na raiz do projeto, rode:

```bash
python3 -m http.server 8001
```

Depois abra:

```text
http://localhost:8001/intdex.html
```

Use Chrome ou Edge com suporte a WebGPU.

## Controles

- Arrastar com o mouse: rotaciona a camera.
- Scroll do mouse: zoom.
- Shift + arrastar: move a camera.
- Botao do meio ou direito + arrastar: move a camera.
- `W`, `A`, `S`, `D`: movimenta a camera.
- `Q` e `E`: desce/sobe a camera.
- `Pausar/Play`: controla a simulacao.
- `Velocidade`: altera quantos passos a simulacao tenta executar por segundo.
- `Auto`: liga/desliga a rotacao automatica.
- `Reset`: gera um estado inicial aleatorio.
- `X`, `Y`, `Z` + `Aplicar`: altera o tamanho do grid.

## Regras

A simulacao usa Conway classico `B3/S23` em cada camada `Z`.

- Uma celula morta nasce com exatamente 3 vizinhos vivos.
- Uma celula viva sobrevive com 2 ou 3 vizinhos vivos.
- Em qualquer outro caso, a celula morre.

Cada camada `Z` funciona como uma fatia do Jogo da Vida. O resultado visual continua 3D porque varias fatias sao renderizadas no espaco.

## Observacoes

O arquivo principal se chama `intdex.html`, mantendo o nome atual do projeto.

Se a tela mostrar aviso de WebGPU indisponivel, verifique:

- Se esta abrindo por `localhost`, nao por arquivo direto.
- Se o navegador suporta WebGPU.
- Se a aceleracao de hardware esta ativa.
