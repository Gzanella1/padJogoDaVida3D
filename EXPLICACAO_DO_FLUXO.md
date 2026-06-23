# Explicacao do Fluxo

Este arquivo explica a ordem em que as coisas acontecem.
Ele e diferente da explicacao do codigo porque aqui o foco e o caminho:

```text
o que acontece primeiro?
quem chama quem?
quando a simulacao roda?
quando os cubos sao desenhados?
como os dados saem do JavaScript e entram na GPU?
```

## Visao Geral Do Fluxo

O projeto tem dois momentos principais:

1. inicializacao;
2. repeticao de frames.

Na inicializacao, o codigo cria tudo que sera usado:

- canvas;
- GPU device;
- camera;
- controles;
- simulacao;
- renderizador;
- buffers;
- pipelines.

Depois disso, entra no loop de frames.
Em cada frame, a aplicacao:

1. atualiza a camera;
2. avanca a simulacao se ja passou tempo suficiente;
3. prepara a lista de celulas vivas;
4. desenha os cubos vivos;
5. pede o proximo frame.

## Fluxo 1: O Navegador Carrega A Pagina

Tudo comeca em `intdex.html`.

O navegador le o HTML e encontra:

```html
<script type="module" src="./src/main.js"></script>
```

Isso carrega `src/main.js`.

Como `main.js` e um modulo, ele tambem importa outros arquivos:

```js
import { Camera } from "./Camera.js";
import { Controls } from "./Controls.js";
import { LifeRenderer3D } from "./LifeRenderer3D.js";
import { LifeSimulation3D } from "./LifeSimulation3D.js";
```

Entao, antes de rodar a aplicacao, o navegador ja sabe onde estao as classes
principais.

## Fluxo 2: `main.js` Pega Os Elementos Da Tela

Logo no comeco:

```js
const canvas = document.querySelector("#lifeCanvas");
const unsupported = document.querySelector("#unsupported");
```

Isso pega:

- o canvas onde a cena sera desenhada;
- o aviso de erro caso WebGPU nao funcione.

Sem canvas, nao existe lugar para desenhar.

## Fluxo 3: `init()` Inicia O WebGPU

No final do arquivo existe:

```js
init().catch((error) => {
  console.error(error);
  showUnsupported(error.message || "Falha ao iniciar a aplicacao WebGPU.");
});
```

Isso chama a funcao principal `init()`.

Se algo der errado, o erro aparece no console e a mensagem de erro aparece na tela.

Dentro de `init()`, primeiro acontece:

```js
if (!navigator.gpu) {
  showUnsupported(...);
  return;
}
```

Esse ponto responde:

```text
este navegador consegue usar WebGPU?
```

Se nao conseguir, o codigo para.

## Fluxo 4: Escolha Da GPU

Depois:

```js
const adapter = await navigator.gpu.requestAdapter({
  powerPreference: "high-performance",
});
```

O navegador procura uma GPU disponivel.

`powerPreference: "high-performance"` pede uma GPU mais forte quando possivel.

Depois:

```js
const device = await adapter.requestDevice();
```

O `device` e criado.
Ele sera usado por quase todos os arquivos.

Pense nele como:

```text
device = controle remoto da GPU
```

Com ele o codigo cria buffers, pipelines e envia comandos.

## Fluxo 5: O Canvas E Configurado

Depois:

```js
const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format,
  alphaMode: "opaque",
});
```

Isso conecta o canvas ao WebGPU.

`format` define como as cores serao guardadas na textura final.

`alphaMode: "opaque"` diz que o canvas final nao precisa ser transparente em
relacao ao HTML por baixo.

## Fluxo 6: Criacao Da Camera E Dos Controles

Depois:

```js
const camera = new Camera();
const controls = new Controls(canvas, camera);
```

A camera sabe:

- onde esta;
- para onde olha;
- qual a distancia ate o alvo;
- qual a perspectiva.

Os controles recebem o canvas e a camera porque precisam escutar eventos no
canvas e modificar a camera.

Exemplo:

```text
usuario arrasta o mouse
  -> Controls recebe pointermove
  -> chama camera.orbit(dx, dy)
  -> camera muda yaw e pitch
```

## Fluxo 7: Criacao Da Simulacao

Depois:

```js
const simulation = new LifeSimulation3D(device, readGridInputs());
```

Esse objeto cria a parte de vida e morte das celulas.

Dentro do construtor:

```js
this.createPipeline();
this.resize(dimensions);
```

Ou seja:

1. cria o pipeline do shader de simulacao;
2. cria os buffers do grid;
3. preenche o estado inicial aleatorio.

## Fluxo 8: Pipeline Da Simulacao

Dentro de `createPipeline()`, o codigo cria:

- layout de bind group;
- shader module;
- compute pipeline.

O bind group layout diz:

```text
este shader precisa receber:
binding 0: parametros
binding 1: estado de entrada
binding 2: estado de saida
```

O shader module transforma o texto WGSL em um modulo que a GPU entende.

O compute pipeline define que a funcao `computeMain` sera executada.

## Fluxo 9: Buffers Da Simulacao

Dentro de `resize()`, o codigo calcula o tamanho do grid:

```js
this.total = x * y * z;
```

Depois cria:

- `paramsBuffer`;
- `stateBuffers[0]`;
- `stateBuffers[1]`;
- `bindGroups[0]`;
- `bindGroups[1]`.

O `paramsBuffer` guarda:

```text
grid.x
grid.y
grid.z
total
birth
surviveMin
surviveMax
```

Os dois `stateBuffers` guardam as celulas.

Os dois `bindGroups` indicam qual buffer sera lido e qual sera escrito:

```text
bindGroups[0]: le A, escreve B
bindGroups[1]: le B, escreve A
```

## Fluxo 10: Estado Inicial Aleatorio

Ainda dentro da simulacao, o metodo `randomize()` cria um array:

```js
const state = new Uint32Array(this.total);
```

Ele percorre todas as posicoes do grid.
Para cada celula, sorteia se ela nasce viva ou morta.

Depois envia esse array para a GPU:

```js
this.device.queue.writeBuffer(this.stateBuffers[0], 0, state);
```

O segundo buffer recebe zeros.

## Fluxo 11: Ajuste Da Camera Ao Grid

Depois da simulacao existir:

```js
camera.fitToGrid(simulation.dimensions);
```

Isso ajusta a distancia da camera conforme o tamanho do grid.

Se o grid for grande, a camera fica mais longe.
Se for pequeno, fica mais perto.

## Fluxo 12: Criacao Do Renderizador

Depois:

```js
const renderer = new LifeRenderer3D(device, context, canvas, format, simulation);
```

Dentro do construtor do renderizador:

```js
this.createGeometry();
this.createPipelines();
this.setSimulation(simulation);
```

Traduzindo:

1. crie a geometria base de um cubo;
2. crie os pipelines usados para renderizar;
3. conecte o renderizador com a simulacao atual.

## Fluxo 13: Criacao Da Geometria Do Cubo

`createGeometry()` chama `createCubeGeometry()`.

Essa funcao cria:

- vertices;
- normais;
- indices.

O cubo base e criado uma vez.
Depois a GPU repete esse mesmo cubo para cada celula viva.

Esse e um dos pontos mais importantes do fluxo:

```text
nao existe um objeto cubo separado para cada celula no JavaScript
existe uma geometria base
a GPU desenha muitas instancias dela
```

## Fluxo 14: Pipelines Do Renderizador

`createPipelines()` cria tres pipelines principais:

1. pipeline de renderizacao dos cubos;
2. pipeline para resetar o draw indireto;
3. pipeline para compactar celulas vivas.

### Pipeline De Renderizacao

Esse pipeline usa `renderShader.js`.

Ele define:

- vertex shader: `vertexMain`;
- fragment shader: `fragmentMain`;
- formato dos vertices;
- blend/transparencia;
- desenho por triangulos;
- teste de profundidade.

O teste de profundidade e importante para que cubos mais perto da camera
aparecam na frente dos cubos mais distantes.

### Pipeline De Reset

Esse pipeline usa `indirectResetShader`.

Antes de cada renderizacao, ele zera a contagem de instancias vivas.

### Pipeline De Compactacao

Esse pipeline usa `aliveCompactShader`.

Ele percorre o estado atual e cria a lista de celulas vivas.

## Fluxo 15: Recursos Ligados A Simulacao

`setSimulation(simulation)` conecta o renderizador aos buffers da simulacao.

Ele cria:

- `aliveCellsBuffer`;
- `indirectBuffer`;
- bind groups para compactacao;
- bind group de renderizacao.

`aliveCellsBuffer` guarda a lista final das celulas vivas.

`indirectBuffer` guarda os argumentos para:

```js
pass.drawIndexedIndirect(this.indirectBuffer, 0);
```

Ou seja, a GPU decide quantas instancias vai desenhar com base no resultado da
compactacao.

## Fluxo 16: Inicio Do Loop De Frames

Depois da inicializacao:

```js
requestAnimationFrame(frame);
```

O navegador chama `frame(now)` antes de desenhar o proximo quadro.

Esse processo repete enquanto a pagina esta aberta.

## Fluxo 17: Calculo Do Tempo

Dentro do frame:

```js
const deltaTime = Math.min((now - lastTime) / 1000, 0.05);
lastTime = now;
```

`now` vem em milissegundos.
Dividir por `1000` transforma em segundos.

O `Math.min(..., 0.05)` limita o tempo maximo considerado.
Isso evita um salto enorme caso a aba trave por um momento.

## Fluxo 18: Atualizacao Dos Controles

Depois:

```js
controls.update(deltaTime);
```

Esse metodo olha quais teclas estao pressionadas.

Se `W`, `A`, `S`, `D`, `Q` ou `E` estiverem ativas, ele move a camera.

Eventos de mouse, como arrastar e zoom, ja chamam metodos da camera diretamente
quando acontecem.

## Fluxo 19: Criacao Do Encoder Do Frame

Depois:

```js
const encoder = device.createCommandEncoder({ label: "Life frame encoder" });
```

Tudo que a GPU deve fazer neste frame sera gravado nesse encoder.

Pense no encoder como uma lista de tarefas:

```text
tarefa 1: atualizar celulas
tarefa 2: preparar celulas vivas
tarefa 3: desenhar cubos
```

## Fluxo 20: Controle Da Velocidade Da Simulacao

O codigo usa:

```js
accumulator += deltaTime;
const interval = 1 / speed;
```

Com `speed = 8`:

```text
interval = 1 / 8 = 0.125 segundos
```

Enquanto o acumulador tiver tempo suficiente, roda mais um passo:

```js
while (accumulator >= interval && stepsThisFrame < 5) {
  simulation.encodeStep(encoder);
  accumulator -= interval;
  stepsThisFrame += 1;
}
```

O limite `stepsThisFrame < 5` evita que a simulacao tente recuperar passos
demais em um unico frame.

## Fluxo 21: O Que Acontece Em `simulation.encodeStep`

Quando `encodeStep(encoder)` roda, ele nao calcula tudo imediatamente no CPU.
Ele grava um comando para a GPU executar depois.

O metodo:

1. abre um compute pass;
2. escolhe o pipeline de simulacao;
3. escolhe o bind group atual;
4. despacha workgroups;
5. fecha o compute pass;
6. troca o buffer atual.

O ponto mais importante:

```text
o JavaScript nao percorre as celulas
a GPU percorre as celulas no compute shader
```

## Fluxo 22: Renderizacao Comeca

Depois dos passos da simulacao:

```js
renderer.render(encoder, camera, deltaTime, now * 0.001, autoRotate);
```

O renderizador recebe:

- o mesmo encoder do frame;
- a camera;
- o tempo desde o ultimo frame;
- o tempo total em segundos;
- se deve rotacionar automaticamente.

## Fluxo 23: Resize Do Canvas

Dentro de `render()`:

```js
this.resize();
```

Isso verifica se o tamanho real do canvas precisa mudar.

O canvas tem:

- tamanho CSS na tela;
- tamanho interno em pixels.

O codigo multiplica pelo `devicePixelRatio` para ficar mais nitido em telas de
alta densidade.

Quando o tamanho muda, a textura de profundidade tambem precisa ser recriada.

## Fluxo 24: Atualizacao Dos Uniforms

Depois:

```js
this.updateUniforms(camera, deltaTime, elapsedSeconds, autoRotate);
```

Uniforms sao dados pequenos enviados para o shader.

Neste projeto, eles incluem:

- matriz `viewProjection`;
- matriz `model`;
- tamanho do grid;
- espacamento;
- direcao da luz;
- posicao da camera;
- tempo.

Esses dados vao para o `renderUniformBuffer`.

## Fluxo 25: Compactacao Das Celulas Vivas

Depois:

```js
this.encodeAliveCompaction(encoder);
```

Essa etapa tem dois passes:

1. reset;
2. compactacao.

### Reset

O reset coloca:

```text
indexCount = 36
instanceCount = 0
```

Isso prepara o draw indireto.

### Compactacao

Depois, o shader percorre todas as celulas.

Se a celula estiver morta:

```text
nao faz nada
```

Se estiver viva:

```text
pega um slot livre na lista
guarda indice + idade
aumenta instanceCount
```

No final dessa etapa:

```text
aliveCellsBuffer = lista de celulas vivas
indirectBuffer.instanceCount = quantidade de cubos
```

## Fluxo 26: Render Pass

Agora o renderizador abre um render pass:

```js
const pass = encoder.beginRenderPass(...);
```

Esse render pass:

- limpa a tela com uma cor de fundo;
- limpa a textura de profundidade;
- prepara o desenho dos cubos.

Depois:

```js
pass.setPipeline(this.renderPipeline);
pass.setBindGroup(0, this.renderBindGroup);
pass.setVertexBuffer(0, this.vertexBuffer);
pass.setIndexBuffer(this.indexBuffer, "uint16");
```

Isso diz para a GPU:

- qual pipeline usar;
- quais uniforms e lista de celulas vivas usar;
- qual geometria de cubo usar;
- quais indices formam os triangulos.

## Fluxo 27: Draw Indireto

A chamada final de desenho e:

```js
pass.drawIndexedIndirect(this.indirectBuffer, 0);
```

Ela e especial.

Em vez do JavaScript dizer diretamente:

```text
desenhe 1540 cubos
```

a GPU le essa quantidade do `indirectBuffer`.

Esse numero foi calculado antes pelo `aliveCompactShader`.

Entao o fluxo fica:

```text
GPU compacta celulas vivas
GPU escreve quantidade de cubos
GPU usa essa quantidade para desenhar
```

Isso evita trazer dados de volta para o JavaScript.

## Fluxo 28: Vertex Shader Para Cada Cubo

Para cada cubo vivo, o vertex shader roda para os vertices da geometria.

Ele recebe:

```text
qual vertice do cubo?
qual instancia/celula viva?
```

Com isso ele calcula:

```text
posicao final do vertice na tela
```

O caminho e:

```text
indice da celula
  -> coordenada x,y,z
  -> centro da celula no mundo
  -> vertice do cubo escalado
  -> rotacao do modelo
  -> camera
  -> perspectiva
  -> tela
```

## Fluxo 29: Fragment Shader Para Cada Pixel

Depois que os triangulos estao posicionados, a GPU descobre quais pixels eles
cobrem.

Para cada pixel, o fragment shader calcula a cor.

Ele usa:

- cor baseada na posicao;
- idade da celula;
- luz;
- borda brilhante;
- pulso de tempo.

No final retorna:

```wgsl
return vec4f(color, alpha);
```

`color` e RGB.
`alpha` e transparencia.

## Fluxo 30: Envio Dos Comandos

Depois que simulacao e renderizacao foram gravadas no encoder:

```js
device.queue.submit([encoder.finish()]);
```

Agora sim a GPU recebe a lista de tarefas.

Depois:

```js
requestAnimationFrame(frame);
```

O proximo frame e agendado.

## Caminho Completo De Uma Celula

Vamos seguir uma celula imaginaria.

### 1. Ela nasce no estado inicial

`randomize()` sorteia:

```text
celula indice 300 = viva
```

O buffer recebe:

```text
state[300] = 1
```

### 2. A simulacao atualiza

No compute shader, a GPU conta os vizinhos da celula 300.

Se ela sobreviver:

```text
stateOut[300] = 2
```

Se morrer:

```text
stateOut[300] = 0
```

### 3. A compactacao olha essa celula

Se `state[300] > 0`, o `aliveCompactShader` coloca ela na lista:

```text
aliveCells[algumSlot] = indice 300 + idade
```

### 4. O render shader desenha

O vertex shader recebe essa instancia.
Ele converte o indice 300 para uma coordenada `x, y, z`.

Depois posiciona o cubo nesse lugar.

### 5. O fragment shader colore

O fragment shader usa a posicao e a idade para gerar cor e brilho.

Resultado:

```text
a celula vira um cubo neon na tela
```

## Fluxo Resumido Em Forma De Diagrama

```text
intdex.html
  carrega main.js

main.js
  verifica WebGPU
  cria device
  configura canvas
  cria Camera
  cria Controls
  cria LifeSimulation3D
  cria LifeRenderer3D
  inicia requestAnimationFrame

frame()
  calcula deltaTime
  atualiza Controls
  cria command encoder

  se passou tempo suficiente:
    LifeSimulation3D.encodeStep()
      simulationShader.computeMain()
      le estado antigo
      escreve estado novo
      troca buffer atual

  LifeRenderer3D.render()
    resize()
    updateUniforms()
    renderPrepShader.resetIndirect()
    renderPrepShader.compactAlive()
    renderShader.vertexMain()
    renderShader.fragmentMain()

  device.queue.submit()
  requestAnimationFrame(frame)
```

## Ideia Principal Do Fluxo

O JavaScript e o organizador.
A GPU e quem faz o trabalho pesado.

O JavaScript:

- cria objetos;
- cria buffers;
- configura pipelines;
- grava comandos;
- envia comandos.

A GPU:

- calcula a simulacao;
- filtra celulas vivas;
- transforma vertices;
- calcula cores;
- desenha os cubos.

Essa separacao e o motivo do projeto conseguir lidar com milhares de celulas
sem o JavaScript precisar desenhar uma por uma.
