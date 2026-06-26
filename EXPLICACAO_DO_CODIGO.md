# Explicacao do Codigo

Este documento explica o codigo do projeto com mais calma.
A ideia nao e so dizer "esse arquivo faz tal coisa", mas explicar:

- o que e cada conceito;
- para que ele serve;
- como ele aparece no codigo;
- como tudo se conecta para formar os cubos na tela.

O projeto e uma variacao tridimensional inspirada no Jogo da Vida. Ele usa
JavaScript puro, WebGPU e shaders. A simulacao e o desenho ficam
principalmente na GPU.

Importante: esta implementacao nao e o Jogo da Vida de Conway classico
`B3/S23`. Ela e um automato celular Life-like 3D com regra `B6/S567`.

## Visao Geral Do Projeto

O projeto simula um volume de celulas. Cada celula tem uma coordenada
`(x, y, z)` e pode estar morta ou viva.

Quando uma celula esta viva, o renderizador mostra um cubo naquela posicao.
Quando esta morta, nada e desenhado naquela posicao.

A simulacao e 3D de verdade porque a regra de evolucao considera vizinhos nas
tres dimensoes:

```text
x = esquerda / direita
y = baixo / cima
z = camada anterior / camada seguinte
```

No Jogo da Vida 2D, uma celula olha ate 8 vizinhos em um quadrado `3x3`.
Nesta versao 3D, uma celula olha ate 26 vizinhos em um cubo `3x3x3`.

Isso significa que o projeto deve ser explicado como um volume 3D acoplado.
Uma celula pode nascer ou morrer por causa de vizinhos na mesma camada, na
camada acima ou na camada abaixo.

## Mapa Mental do Projeto

Antes de entrar nos arquivos, pense no projeto como uma fabrica:

```text
main.js
  liga a fabrica e coordena tudo

LifeSimulation3D.js
  calcula quais celulas estao vivas ou mortas

simulationShader.js
  faz a conta da simulacao dentro da GPU

LifeRenderer3D.js
  prepara e manda desenhar os cubos

renderPrepShader.js
  cria uma lista so com as celulas vivas

renderShader.js
  posiciona e colore cada cubo na tela

Camera.js
  calcula de onde o usuario esta olhando

Controls.js
  transforma mouse e teclado em movimento da camera

math.js
  guarda as funcoes matematicas usadas pela camera e pela cena
```

O arquivo `intdex.html` cria a pagina e o canvas onde tudo sera desenhado.

## Conceitos Basicos Antes do Codigo

### O Que E WebGPU

WebGPU e uma API do navegador que permite usar a GPU diretamente.

GPU significa "placa de video" ou "processador grafico".
Ela e muito boa em fazer muitas contas parecidas ao mesmo tempo.

Neste projeto, a GPU faz tres coisas importantes:

- calcula a proxima geracao do automato celular;
- compacta a lista de celulas vivas para o desenho;
- desenha muitos cubos na tela.

O JavaScript nao desenha cubo por cubo. Ele prepara os dados e manda comandos.
A GPU executa esses comandos.

### O Que E Canvas

O canvas e uma area da pagina onde o navegador pode desenhar.

No HTML:

```html
<canvas id="lifeCanvas"></canvas>
```

No JavaScript:

```js
const canvas = document.querySelector("#lifeCanvas");
const context = canvas.getContext("webgpu");
```

Isso significa:

- `canvas` e o elemento visual;
- `context` e a ligacao entre o canvas e o WebGPU.

### O Que E Device

O `device` representa o acesso ao hardware da GPU.

No `main.js`:

```js
const adapter = await navigator.gpu.requestAdapter({
  powerPreference: "high-performance",
});

const device = await adapter.requestDevice();
```

O `adapter` e como escolher uma GPU disponivel.
O `device` e como abrir uma conexao com essa GPU.

Quase tudo no projeto passa pelo `device`:

- criar buffers;
- criar shaders;
- criar pipelines;
- enviar dados;
- enviar comandos.

### O Que E Buffer

Buffer e um bloco de memoria na GPU.

Ele serve para guardar dados que os shaders vao usar.

Exemplos neste projeto:

- estado das celulas;
- vertices do cubo;
- indices dos triangulos;
- lista das celulas vivas;
- dados da camera;
- argumentos para desenhar indiretamente.

Pense em buffer como uma tabela de numeros que fica dentro da GPU.

### O Que E Shader

Shader e um programa pequeno que roda na GPU.

Neste projeto existem tres tipos de shader:

- compute shader: faz calculos gerais;
- vertex shader: calcula a posicao dos vertices;
- fragment shader: calcula a cor dos pixels.

Os shaders do projeto estao em:

```text
src/shaders/simulationShader.js
src/shaders/renderPrepShader.js
src/shaders/renderShader.js
```

Eles sao escritos em WGSL, a linguagem de shader do WebGPU.

### O Que E Pipeline

Pipeline e a configuracao que diz para a GPU como executar um shader.

Um shader sozinho e so codigo.
O pipeline diz:

- qual shader sera usado;
- quais buffers entram;
- qual formato de vertice existe;
- se vai desenhar triangulos;
- se vai usar profundidade;
- se vai misturar transparencia;
- qual funcao do shader e o ponto de entrada.

No projeto existem pipelines para:

- simular celulas;
- compactar celulas vivas;
- renderizar cubos.

### O Que E Bind Group

Bind group e um pacote que conecta buffers aos shaders.

Um shader pode dizer:

```wgsl
@group(0) @binding(1) var<storage, read> stateIn: array<u32>;
```

Isso significa:

"No grupo 0, binding 1, eu espero receber um buffer chamado `stateIn`."

No JavaScript, o bind group entrega esse buffer:

```js
entries: [
  { binding: 1, resource: { buffer: this.stateBuffers[0] } },
]
```

Entao:

- shader declara o que quer;
- JavaScript cria o bind group com os buffers certos;
- GPU junta as duas coisas.

### O Que E Command Encoder

O `GPUCommandEncoder` e onde o JavaScript grava comandos para a GPU.

No `main.js`:

```js
const encoder = device.createCommandEncoder({ label: "Life frame encoder" });
```

Durante o frame, o codigo adiciona comandos nesse encoder:

- rode a simulacao;
- compacte as celulas vivas;
- renderize a cena.

No final:

```js
device.queue.submit([encoder.finish()]);
```

Isso envia os comandos para a GPU executar.

## Entrada: `intdex.html`

O arquivo `intdex.html` e a pagina do projeto.

Ele contem:

- o canvas principal;
- estilos visuais;
- uma mensagem de erro caso WebGPU nao esteja disponivel;
- o import do JavaScript principal.

O import e:

```html
<script type="module" src="./src/main.js"></script>
```

`type="module"` permite usar `import` e `export` nos arquivos JavaScript.

A barra de controles existe no HTML, mas esta comentada.
Por isso, na versao atual, o projeto roda com valores fixos definidos em
`src/main.js`.

## Arquivo `src/main.js`

O `main.js` e o coordenador da aplicacao.
Ele nao faz a matematica pesada nem desenha os cubos diretamente.
Ele organiza quem faz cada trabalho.

### Valores Iniciais

No topo:

```js
const DEFAULT_SIMULATION_SPEED = 1;
const DEFAULT_AUTO_ROTATE = false;
const DEFAULT_GRID_DIMENSIONS = { x: 32, y: 32, z: 32 };
```

Isso quer dizer:

- a simulacao tenta rodar 1 passo por segundo;
- a cena nao gira automaticamente;
- o grid tem largura 32, altura 32 e profundidade 32.

### Verificacao do WebGPU

O codigo verifica:

```js
if (!navigator.gpu) {
  showUnsupported(...);
  return;
}
```

Se o navegador nao tiver WebGPU, nao adianta continuar.
Entao ele mostra uma mensagem de erro.

### Criacao das Pecas Principais

Depois que o WebGPU esta pronto, o `main.js` cria:

```js
const camera = new Camera();
const controls = new Controls(canvas, camera);
const simulation = new LifeSimulation3D(device, readGridInputs());
camera.fitToGrid(simulation.dimensions);
const renderer = new LifeRenderer3D(device, context, canvas, format, simulation);
```

Cada linha cria uma parte:

- `Camera`: define de onde a cena e vista;
- `Controls`: liga mouse e teclado na camera;
- `LifeSimulation3D`: cria e atualiza as celulas;
- `LifeRenderer3D`: desenha os cubos.

### Loop Principal

A funcao `frame(now)` roda uma vez por quadro da animacao.

Ela e chamada por:

```js
requestAnimationFrame(frame);
```

Dentro do frame acontecem estas etapas:

```text
1. calcula deltaTime
2. atualiza camera pelos controles
3. cria encoder de comandos
4. roda passos da simulacao
5. renderiza a cena
6. envia comandos para GPU
7. pede o proximo frame
```

`deltaTime` e o tempo entre um frame e outro.
Ele e importante porque o computador pode rodar a 60 FPS, 144 FPS ou menos.
Usar tempo real evita que a simulacao dependa totalmente da velocidade da tela.

## Arquivo `src/LifeSimulation3D.js`

Este arquivo cuida da vida e morte das celulas.

Ele nao cuida da camera nem da cor.
Ele so responde:

```text
qual celula esta viva?
qual celula esta morta?
qual sera o proximo estado?
```

### Estado da Celula

Cada celula e guardada como um numero inteiro `u32`.

```text
0      = morta
1..255 = viva
```

Quando a celula esta viva, o numero tambem representa idade.

Exemplo:

```text
0  -> morta
1  -> acabou de nascer
8  -> viva ha 8 passos
255 -> viva ha muito tempo, travada no limite maximo
```

A idade serve para efeito visual.
Celulas novas podem brilhar diferente das antigas.

### Por Que Existem Dois Buffers

O codigo cria:

```js
this.stateBuffers = [
  device.createBuffer(...),
  device.createBuffer(...),
];
```

Esses dois buffers sao chamados de A e B.

Eles existem porque a proxima geracao precisa ser calculada olhando a geracao
antiga inteira.

Se voce calculasse tudo no mesmo lugar, aconteceria um problema:

```text
celula 1 muda
celula 2 olha para celula 1
mas agora celula 1 ja esta com valor novo
```

Isso misturaria passado e futuro.

Com dois buffers:

```text
passo 1: le A e escreve B
passo 2: le B e escreve A
passo 3: le A e escreve B
```

Esse padrao se chama ping-pong buffer.

Esse nome vem da alternancia:

```text
A -> B
B -> A
A -> B
```

Assim, a GPU sempre le um estado completo e escreve o proximo estado em outro
lugar. Isso evita misturar dados antigos e novos na mesma geracao.

### Criacao do Grid

No metodo `resize(dimensions)`, o codigo ajusta o tamanho:

```js
const x = alignDimension(dimensions.x, 8, 64);
const y = alignDimension(dimensions.y, 8, 64);
const z = alignDimension(dimensions.z, 1, 48);
```

Isso impede tamanhos absurdos.

Depois calcula:

```js
this.total = x * y * z;
```

Com `32 x 32 x 32`, o total e:

```text
32 * 32 * 32 = 32768 celulas
```

### Estado Inicial Aleatorio

O metodo `randomize()` preenche o primeiro buffer com celulas vivas e mortas.

Ele usa:

```js
Math.random() < density * bias
```

Isso significa:

- `density` define a chance base de uma celula nascer viva;
- `bias` muda essa chance dependendo da distancia ate o centro.

Por isso o estado inicial nao e totalmente uniforme.
Ele tende a ficar mais interessante visualmente.

### Passo da Simulacao

O metodo `encodeStep(encoder)` adiciona um compute pass no encoder.

Ele faz:

```js
pass.setPipeline(this.pipeline);
pass.setBindGroup(0, this.bindGroups[this.currentStateIndex]);
pass.dispatchWorkgroups(...);
```

Traduzindo:

- use o pipeline da simulacao;
- use o bind group que le o estado atual e escreve no outro buffer;
- execute varios grupos de trabalho na GPU.

`dispatchWorkgroups` nao executa um loop JavaScript celula por celula. Ele
manda para a GPU uma grade de grupos de trabalho. Dentro desses grupos, as
invocacoes do compute shader calculam celulas diferentes em paralelo.

Depois:

```js
this.currentStateIndex = 1 - this.currentStateIndex;
```

Isso troca o buffer atual:

```text
se era 0, vira 1
se era 1, vira 0
```

## Arquivo `src/shaders/simulationShader.js`

Este shader calcula a regra do automato celular Life-like 3D.

Ele roda uma vez para cada celula.

### Workgroup

No arquivo:

```js
export const SIM_WORKGROUP_SIZE = 4;
```

E no shader:

```wgsl
@compute @workgroup_size(4, 4, 4)
```

Isso quer dizer que cada grupo de trabalho tem:

```text
4 * 4 * 4 = 64 invocacoes
```

Cada invocacao calcula uma celula. Como existem muitas invocacoes rodando na
GPU, muitas celulas podem ser processadas em paralelo.

### Entrada e Saida

O shader recebe:

```wgsl
@binding(0) params
@binding(1) stateIn
@binding(2) stateOut
```

Significado:

- `params`: dimensoes do grid e regras;
- `stateIn`: estado antigo;
- `stateOut`: estado novo.

### Contagem de Vizinhos

O shader percorre:

```wgsl
for (var dz = -1i; dz <= 1i; dz = dz + 1i) {
  for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
    for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
```

Ele olha os vizinhos em volta da celula.
Quando `dx == 0`, `dy == 0` e `dz == 0`, ele pula, porque isso seria a propria celula.

Essa vizinhanca se chama vizinhanca Moore 3D.

O cubo `3x3x3` tem:

```text
3 * 3 * 3 = 27 posicoes
```

Mas uma dessas posicoes e a propria celula. Por isso:

```text
27 - 1 = 26 vizinhas
```

Importante: ele conta vizinhos tambem nas camadas `z` anterior e seguinte.
Ou seja, cada celula consulta ate 26 vizinhos dentro do cubo `3x3x3`.

A chamada que faz isso e:

```wgsl
activeNeighbors = activeNeighbors + cellActive(cx + dx, cy + dy, cz + dz);
```

O `cz + dz` mostra que a profundidade tambem entra na contagem. Como a chamada
usa `cz + dz`, a simulacao evolui como um volume 3D real.

### Bordas Periodicas

A funcao `wrappedGridIndex` aplica modulo nas tres dimensoes:

```wgsl
let x = (xValue + gx) % gx;
let y = (yValue + gy) % gy;
let z = (zValue + gz) % gz;
```

Isso cria bordas periodicas em `x`, `y` e `z`.

Exemplo: se uma celula na borda tenta consultar `x = -1`, o codigo volta para o
ultimo `x` do grid. A mesma ideia vale para `y` e `z`.

### Regras B6/S567

O codigo usa:

```wgsl
let born = activeNeighbors == params.rules.x;
let survives = activeNeighbors >= params.rules.y && activeNeighbors <= params.rules.z;
```

No JavaScript, as regras sao:

```js
birth: 6,
surviveMin: 5,
surviveMax: 7,
```

Entao:

- `B6`: celula morta nasce com exatamente 6 vizinhos ativos;
- `S567`: celula viva sobrevive com 5, 6 ou 7 vizinhos ativos;
- caso contrario morre.

Essa regra e Life-like porque segue a ideia de nascimento e sobrevivencia do
Jogo da Vida, mas nao e a regra classica `B3/S23`. Ela foi escolhida para uma
vizinhanca 3D com ate 26 vizinhos.

## Arquivo `src/LifeRenderer3D.js`

Este arquivo cuida de transformar celulas vivas em cubos visiveis.

Ele faz quatro trabalhos grandes:

1. cria a geometria base do cubo;
2. cria pipelines de renderizacao e compactacao;
3. cria buffers usados no desenho;
4. desenha uma instancia do cubo para cada celula viva.

## Como Foram Feitos os Quadrados/Cubos

Na tela, voce ve pequenos "quadrados" com profundidade.
Tecnicamente eles sao cubos 3D.

Cada cubo tem 6 faces quadradas:

```text
frente
tras
direita
esquerda
cima
baixo
```

No codigo, isso aparece na funcao `createCubeGeometry()`:

```js
const faces = [
  { normal: [0, 0, 1], corners: [...] },
  { normal: [0, 0, -1], corners: [...] },
  ...
];
```

Cada item representa uma face do cubo.

### O Que E Um Vertice

Vertice e um ponto no espaco.

Um ponto 3D tem tres coordenadas:

```text
x, y, z
```

Exemplo:

```text
[-1, -1, 1]
```

Esse ponto esta:

- 1 unidade para a esquerda no eixo x;
- 1 unidade para baixo no eixo y;
- 1 unidade para frente no eixo z.

### O Que E Uma Face

Uma face quadrada do cubo tem quatro cantos.

Visualmente:

```text
v0 ----- v1
|        |
|        |
v3 ----- v2
```

Mas a GPU nao desenha quadrados diretamente.
Ela desenha triangulos.

Entao cada quadrado vira dois triangulos:

```text
triangulo 1: v0, v1, v2
triangulo 2: v0, v2, v3
```

No codigo:

```js
indices.push(
  vertexOffset,
  vertexOffset + 1,
  vertexOffset + 2,
  vertexOffset,
  vertexOffset + 2,
  vertexOffset + 3,
);
```

Isso cria os dois triangulos da face.

### Por Que O Cubo Tem 24 Vertices E Nao 8

Um cubo simples tem 8 cantos.
Entao parece que bastariam 8 vertices.

Mas o codigo cria 4 vertices para cada face:

```text
6 faces * 4 vertices = 24 vertices
```

Isso e feito por causa das normais.

### O Que E Normal

Normal e uma seta perpendicular a uma face.

Exemplos:

```text
face da frente:  [0, 0, 1]
face de tras:    [0, 0, -1]
face de cima:    [0, 1, 0]
face de baixo:   [0, -1, 0]
```

A normal serve para calcular luz.

Se os vertices fossem compartilhados por varias faces, a GPU misturaria as
normais e a luz poderia parecer arredondada. Como cada face tem seus proprios
vertices, cada face recebe uma normal reta e o cubo fica com cara de cubo.

### Vertex Buffer

Depois que os vertices sao criados, eles vao para o `vertexBuffer`.

O vertex buffer guarda:

```text
posicao do vertice
normal do vertice
```

Cada vertice tem 6 numeros:

```text
x, y, z, normalX, normalY, normalZ
```

Cada numero e `float32`, ou seja, 4 bytes.

```text
6 * 4 = 24 bytes por vertice
```

Por isso o pipeline tem:

```js
arrayStride: 24
```

### Index Buffer

O index buffer guarda a ordem de montagem dos triangulos.

Em vez de repetir todos os pontos, a GPU le os indices e sabe:

```text
pegue vertice 0
pegue vertice 1
pegue vertice 2
forme um triangulo
```

Como cada face tem 2 triangulos:

```text
6 faces * 2 triangulos * 3 vertices = 36 indices
```

Por isso cada cubo usa 36 indices.

## Instancing: Repetindo O Mesmo Cubo

O projeto nao cria 9000 geometrias diferentes.
Ele cria uma geometria de cubo uma vez e reutiliza.

Isso se chama instancing.

O pensamento e:

```text
tenho um modelo de cubo
para cada celula viva:
  desenhe esse mesmo cubo em outra posicao
```

A GPU recebe:

- o cubo base;
- uma lista de celulas vivas;
- a quantidade de cubos que precisa desenhar.

Depois ela repete a geometria automaticamente.

## Arquivo `src/shaders/renderPrepShader.js`

Antes de desenhar, o projeto precisa saber quais celulas estao vivas.

Desenhar todas as celulas seria desperdicio, porque celulas mortas nao aparecem.

Entao existe uma etapa de preparacao:

```text
estado completo das celulas
  -> compactacao
lista so das celulas vivas
```

### `indirectResetShader`

Esse shader prepara os argumentos do desenho.

Ele coloca:

```wgsl
drawArgs.indexCount = 36u;
instanceCount = 0
```

`indexCount = 36` porque um cubo usa 36 indices.

`instanceCount = 0` porque antes de contar as celulas vivas ainda nao sabemos
quantos cubos serao desenhados.

### `aliveCompactShader`

Esse shader percorre todas as celulas.

Quando encontra uma celula viva:

```wgsl
let slot = atomicAdd(&drawArgs.instanceCount, 1u);
aliveCells[slot] = (age << 24u) | index;
```

Isso faz duas coisas:

1. aumenta a quantidade de instancias vivas;
2. salva a celula no buffer `aliveCells`.

`atomicAdd` e usado porque muitas invocacoes da GPU podem encontrar celulas
vivas ao mesmo tempo. O atomic garante que cada uma pegue uma posicao diferente
na lista.

## Arquivo `src/shaders/renderShader.js`

Este shader realmente desenha os cubos.

Ele tem duas partes:

- vertex shader;
- fragment shader.

### Vertex Shader

O vertex shader roda para cada vertice de cada cubo.

Ele recebe:

- posicao do vertice no cubo base;
- normal do vertice;
- indice da instancia atual.

Com o indice da instancia, ele encontra qual celula viva esta sendo desenhada:

```wgsl
let packedCell = aliveCells[instance];
```

Depois separa:

```wgsl
let cellIndex = packedCell & 0x00ffffffu;
let age = f32(packedCell >> 24u) / 255.0;
```

Isso quer dizer:

- os bits baixos guardam o indice da celula;
- os bits altos guardam a idade.

Depois o shader converte o indice para coordenada `x, y, z` com `cellCoord`.

### Posicionamento Do Cubo

A linha principal e:

```wgsl
let localPosition = centered + input.position * cubeScale;
```

Ela combina duas coisas:

- `centered`: centro da celula dentro do grid;
- `input.position * cubeScale`: formato do cubo, reduzido para caber na celula.

Pense assim:

```text
centered = onde o cubo deve ficar
input.position = formato do cubo
cubeScale = tamanho do cubo
```

Depois:

```wgsl
let world = uniforms.model * vec4f(localPosition, 1.0);
output.position = uniforms.viewProjection * world;
```

Isso aplica:

- rotacao do modelo;
- camera;
- perspectiva.

### Fragment Shader

O fragment shader calcula a cor de cada pixel do cubo.

Ele usa:

- posicao da celula para variar a cor;
- idade para dar brilho diferente em celulas novas;
- normal para calcular luz;
- direcao da camera para criar brilho nas bordas;
- tempo para pulsar.

Por isso os cubos ficam coloridos, iluminados e com brilho neon.

## Arquivo `src/Camera.js`

A camera define de onde o usuario olha a cena.

Ela guarda:

```text
target   = ponto observado
distance = distancia ate esse ponto
yaw      = rotacao horizontal
pitch    = rotacao vertical
fov      = abertura da lente
```

O metodo `getPosition()` calcula a posicao da camera ao redor do alvo.

O metodo `getViewProjection(aspect)` cria a matriz que transforma o mundo 3D
em imagem 2D na tela.

Essa matriz e enviada para o shader.

## Arquivo `src/Controls.js`

Os controles transformam entradas do usuario em movimento da camera.

Eventos usados:

- `pointerdown`;
- `pointermove`;
- `pointerup`;
- `wheel`;
- `keydown`;
- `keyup`.

O mouse orbita ou move a camera.
O scroll aproxima e afasta.
O teclado move o alvo da camera.

## Arquivo `src/math.js`

Este arquivo existe porque WebGPU nao traz automaticamente uma biblioteca de
matrizes para o JavaScript.

Entao o projeto implementa:

- soma de vetores;
- subtracao de vetores;
- multiplicacao por escala;
- produto escalar;
- produto vetorial;
- normalizacao;
- matrizes 4x4;
- perspectiva;
- lookAt;
- rotacoes.

Essas funcoes sao usadas principalmente pela camera e pelo renderizador.

## Por Que Isso E Programacao De Alto Desempenho

O ponto de alto desempenho nao e simplesmente "usar threads".
O ponto central e usar a GPU como processador paralelo.

Na simulacao:

```text
uma invocacao do compute shader = calculo de uma celula
muitas invocacoes = muitas celulas calculadas ao mesmo tempo
workgroups = grupos dessas invocacoes
dispatchWorkgroups = comando que despacha o trabalho para a GPU
```

O JavaScript prepara os buffers, cria os bind groups e grava comandos no
encoder. A GPU executa a parte repetitiva e massiva:

- contar vizinhos em 3D;
- aplicar a regra `B6/S567`;
- escrever o novo estado no buffer de saida;
- compactar as celulas vivas para desenhar somente o que aparece.

Essa arquitetura combina:

- compute shader para calculo geral;
- storage buffers para muitos dados;
- bind groups para conectar buffers aos shaders;
- ping-pong buffers para separar estado antigo e estado novo;
- renderizacao instanciada para repetir a geometria do cubo.

Por isso o projeto pode ser defendido como uma aplicacao de Programacao de Alto
Desempenho: a carga de trabalho principal e paralelizavel e foi movida para a
GPU.

## Resumo Final

O funcionamento completo e:

```text
1. HTML cria o canvas.
2. main.js inicia WebGPU.
3. LifeSimulation3D cria buffers das celulas.
4. simulationShader conta vizinhos em 3D e calcula vida e morte na GPU.
5. renderPrepShader filtra so as celulas vivas.
6. LifeRenderer3D tem uma geometria base de cubo.
7. renderShader repete esse cubo uma vez para cada celula viva.
8. Camera e Controls definem como o usuario ve a cena.
9. math.js fornece as contas de vetores e matrizes.
```

A parte mais importante para entender os "quadrados" e:

```text
um cubo = 6 faces quadradas
uma face quadrada = 2 triangulos
um cubo = 12 triangulos
um cubo = 36 indices
uma geometria de cubo e criada uma vez
a GPU repete essa geometria para cada celula viva
```

Entao o projeto nao desenha quadrados soltos.
Ele desenha cubos instanciados, posicionados em um grid 3D e coloridos por shaders.

Para o artigo, a formulacao mais correta e:

```text
O projeto implementa uma variacao tridimensional Life-like inspirada no Jogo da
Vida de Conway. A simulacao usa vizinhanca Moore 3D com 26 vizinhas, regra
B6/S567 e processamento paralelo na GPU por meio de WebGPU compute shaders.
```
