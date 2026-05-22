# Explicacao do Codigo e Fluxo

Este projeto renderiza uma versao 3D do Jogo da Vida de Conway usando WebGPU e JavaScript puro. A pagina principal e `intdex.html`, e a logica foi separada em modulos dentro de `src/`.

## Visao Geral

O fluxo principal e:

1. `intdex.html` monta a interface visual, o canvas WebGPU e os controles.
2. `src/main.js` inicia o WebGPU, cria a camera, os controles, a simulacao e o renderizador.
3. `LifeSimulation3D` cria os buffers de estado das celulas e executa as regras do jogo no compute shader.
4. `LifeRenderer3D` compacta as celulas vivas na GPU e renderiza apenas essas celulas como cubos.
5. `Camera` e `Controls` permitem orbitar, mover e dar zoom na cena.
6. Os shaders em `src/shaders/` fazem a simulacao, preparam a lista de celulas vivas e desenham os cubos neon.

## `intdex.html`

Este arquivo e a entrada da aplicacao.

Ele contem:

- O `<canvas id="lifeCanvas">`, onde o WebGPU desenha a cena.
- O painel superior com FPS, step e tamanho atual do grid.
- A barra inferior com controles de play/pause, velocidade, rotacao automatica, reset e tamanho do grid.
- O CSS da estetica visual: fundo azul escuro, paineis transluidos, bordas neon e interface futurista.
- O import do modulo principal:

```html
<script type="module" src="./src/main.js"></script>
```

## `src/main.js`

Este e o orquestrador da aplicacao.

Responsabilidades principais:

- Verificar se `navigator.gpu` existe.
- Pedir o adaptador WebGPU e criar o `device`.
- Configurar o contexto WebGPU do canvas.
- Criar:
  - `Camera`
  - `Controls`
  - `LifeSimulation3D`
  - `LifeRenderer3D`
- Ler valores da interface, como velocidade e tamanho do grid.
- Controlar pause/play.
- Fazer reset aleatorio.
- Rodar o loop principal com `requestAnimationFrame`.

No loop principal acontece isto:

1. Calcula o tempo desde o ultimo frame.
2. Atualiza os controles da camera.
3. Cria um `GPUCommandEncoder`.
4. Se a simulacao estiver tocando, executa um ou mais passos da simulacao.
5. Renderiza a cena.
6. Envia os comandos para a GPU com `device.queue.submit`.
7. Atualiza FPS e step na interface.

## `src/LifeSimulation3D.js`

Este modulo cuida da simulacao do Jogo da Vida.

Ele cria dois buffers de estado:

- `Life state A`
- `Life state B`

Esses buffers trabalham em ping-pong:

- Em um passo, a GPU le do buffer A e escreve no B.
- No passo seguinte, le do B e escreve no A.

Isso evita sobrescrever uma celula antes de todas as vizinhas terem sido lidas.

Cada celula e guardada como um `u32`:

- `0` significa celula morta.
- `1..255` significa celula viva, usando o valor como idade.

A idade permite mudar brilho e cor no shader de renderizacao.

### Regras da Simulacao

O shader usa Conway classico em cada camada `Z`:

- Celula morta nasce com exatamente 3 vizinhos vivos.
- Celula viva sobrevive com 2 ou 3 vizinhos vivos.
- Nos outros casos, a celula morre.

O grid continua sendo 3D porque existem varias camadas `Z`, mas cada fatia evolui com a regra classica 2D. Isso deixa o comportamento mais fiel ao Jogo da Vida original.

## `src/shaders/simulationShader.js`

Este arquivo contem o compute shader da simulacao.

Ele roda na GPU, nao no CPU.

Para cada celula, o shader:

1. Descobre sua posicao `x`, `y`, `z`.
2. Conta os 8 vizinhos da mesma camada `z`.
3. Aplica as regras `B3/S23`.
4. Escreve o novo estado no buffer de saida.

O shader tambem usa bordas toroidais: quando passa da borda direita, volta para a esquerda; quando passa da borda de baixo, volta para cima.

## `src/shaders/renderPrepShader.js`

Este arquivo prepara a renderizacao.

Como celulas mortas nao devem ser renderizadas, a GPU cria uma lista apenas com as celulas vivas.

Esse processo tem dois shaders:

- `indirectResetShader`: zera os argumentos do draw indireto.
- `aliveCompactShader`: percorre o estado atual e adiciona na lista somente as celulas vivas.

Cada item da lista guarda:

- O indice da celula.
- A idade da celula empacotada nos bits mais altos.

Depois disso, o renderizador pode chamar `drawIndexedIndirect`, e a GPU desenha somente os cubos vivos.

## `src/LifeRenderer3D.js`

Este modulo cuida da renderizacao 3D.

Responsabilidades:

- Criar a geometria de um cubo.
- Criar o pipeline de renderizacao.
- Criar textura de profundidade.
- Criar os buffers para a lista de celulas vivas.
- Atualizar uniforms de camera, grid, luz e tempo.
- Rodar a compactacao das celulas vivas.
- Renderizar os cubos com `drawIndexedIndirect`.

A geometria do cubo e criada uma vez. Depois, cada celula viva vira uma instancia desse cubo.

Isso e mais eficiente do que criar uma geometria separada para cada celula.

## `src/shaders/renderShader.js`

Este arquivo contem o vertex shader e o fragment shader dos cubos.

### Vertex Shader

O vertex shader:

1. Le a celula viva da lista compactada.
2. Calcula sua coordenada `x`, `y`, `z`.
3. Centraliza o grid no espaco 3D.
4. Aplica escala no cubo.
5. Aplica a matriz de rotacao do modelo.
6. Aplica a camera com `viewProjection`.

### Fragment Shader

O fragment shader cria o visual neon.

Ele usa:

- Cor RGB/HSV saturada.
- Variacao por posicao da celula.
- Idade da celula para mudar brilho.
- Luz direcional simples.
- Rim light para bordas brilhantes.
- Transparencia leve.

## `src/Camera.js`

Este modulo cria uma camera orbital.

Ela guarda:

- `target`: ponto que a camera olha.
- `distance`: distancia ate o alvo.
- `yaw`: rotacao horizontal.
- `pitch`: rotacao vertical.
- `fov`: campo de visao.

Ela tambem gera a matriz `viewProjection`, que combina:

- Matriz de perspectiva.
- Matriz de camera `lookAt`.

## `src/Controls.js`

Este modulo conecta mouse, scroll e teclado na camera.
python3 -m http.server 8001

Controles:

- Arrastar com mouse: orbita a camera.
- Scroll: zoom.
- Shift ou botao do meio/direito: move a camera.
- `W`, `A`, `S`, `D`: move no plano da camera.
- `Q` e `E`: move para baixo/cima.

## `src/math.js`

Este arquivo contem funcoes matematicas usadas pela camera e pelo renderizador.

Ele implementa:

- Vetores 3D.
- Normalizacao.
- Produto vetorial.
- Produto escalar.
- Matrizes 4x4.
- Perspectiva.
- LookAt.
- Rotacoes nos eixos X, Y e Z.

## Fluxo de um Frame

Em cada frame:

1. `main.js` calcula `deltaTime`.
2. `Controls` atualiza a camera.
3. Se estiver em play, `LifeSimulation3D.encodeStep()` adiciona o compute shader da simulacao no command encoder.
4. `LifeRenderer3D.render()` atualiza uniforms.
5. `LifeRenderer3D` reseta o draw indireto.
6. `LifeRenderer3D` compacta as celulas vivas.
7. O render pass limpa a tela e a profundidade.
8. A GPU desenha os cubos vivos.
9. O command encoder e enviado para a GPU.
10. A interface atualiza FPS e step.

## Por Que a Simulacao Fica na GPU

O CPU nao percorre o grid para aplicar as regras.

O CPU apenas:

- Cria buffers.
- Envia comandos.
- Atualiza controles.
- Atualiza interface.

A GPU faz:

- Contagem de vizinhos.
- Nascimento e morte das celulas.
- Compactacao das celulas vivas.
- Renderizacao dos cubos.

Isso deixa a aplicacao mais fluida e permite aumentar o grid com menos custo no CPU.
