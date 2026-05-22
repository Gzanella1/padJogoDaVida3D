# Explicacao do Codigo

Este projeto mostra uma simulacao do Jogo da Vida em uma cena 3D usando WebGPU.
A ideia central e simples:

1. guardar um grid de celulas vivas ou mortas;
2. atualizar esse grid na GPU com as regras do Jogo da Vida;
3. pegar apenas as celulas vivas;
4. desenhar um cubo pequeno para cada celula viva.

Mesmo que voce chame de "quadrados", na tela eles aparecem como cubos 3D.
Cada cubo e feito de faces quadradas, mas a GPU desenha essas faces usando triangulos.

## Entrada da Aplicacao

O arquivo `intdex.html` cria a pagina e o canvas:

```html
<canvas id="lifeCanvas"></canvas>
```

Esse canvas e onde o WebGPU desenha tudo.

No HTML tambem existe uma barra de controles, mas ela esta comentada no momento.
Por isso, a aplicacao atual roda automaticamente com valores fixos definidos em `src/main.js`:

- velocidade da simulacao: `8`;
- rotacao automatica: ligada;
- tamanho do grid: `24 x 24 x 16`.

## Arquivo Principal

O arquivo `src/main.js` e o ponto de partida do JavaScript.

Ele faz estas etapas:

1. procura o canvas na pagina;
2. verifica se o navegador suporta WebGPU;
3. pede um adaptador de GPU;
4. cria o `device`, que e o objeto usado para conversar com a GPU;
5. configura o contexto WebGPU do canvas;
6. cria a camera;
7. cria os controles de mouse e teclado;
8. cria a simulacao;
9. cria o renderizador;
10. inicia o loop de frames com `requestAnimationFrame`.

O loop principal fica dentro da funcao `frame(now)`.
Em cada frame ele:

1. calcula o tempo que passou desde o frame anterior;
2. atualiza os controles da camera;
3. cria um `GPUCommandEncoder`;
4. executa passos da simulacao se estiver tocando;
5. renderiza a cena;
6. envia os comandos para a GPU;
7. chama o proximo frame.

## Simulacao

A simulacao fica em `src/LifeSimulation3D.js`.

Ela cria dois buffers de estado:

- `Life state A`;
- `Life state B`.

Esses buffers funcionam em ping-pong:

- em um passo, a GPU le o buffer A e escreve o resultado no B;
- no passo seguinte, a GPU le o B e escreve no A.

Isso e necessario porque a proxima geracao precisa ser calculada a partir da geracao antiga inteira.
Se o mesmo buffer fosse lido e escrito ao mesmo tempo, uma celula poderia mudar antes de suas vizinhas serem calculadas.

Cada celula e um numero `u32`:

- `0` significa morta;
- `1` ate `255` significa viva;
- esse numero tambem representa a idade da celula.

A idade depois e usada para mudar brilho e cor.

## Shader da Simulacao

O arquivo `src/shaders/simulationShader.js` contem o compute shader que atualiza as celulas.

Esse shader roda na GPU.
Cada invocacao do shader cuida de uma celula do grid.

Para cada celula ele:

1. descobre a posicao `x`, `y`, `z`;
2. conta os 8 vizinhos na mesma camada `z`;
3. aplica as regras do Conway classico;
4. grava o novo estado no buffer de saida.

As regras usadas sao:

- uma celula morta nasce se tiver exatamente 3 vizinhos vivos;
- uma celula viva continua viva se tiver 2 ou 3 vizinhos vivos;
- nos outros casos ela morre.

O `z` cria varias camadas empilhadas.
Cada camada funciona como um tabuleiro 2D separado, mas todas sao desenhadas no espaco 3D.

## Como os Quadrados Foram Feitos

Os "quadrados" visuais ficam em `src/LifeRenderer3D.js`, na funcao `createCubeGeometry()`.

Na verdade, o codigo cria a geometria de um cubo.
Um cubo tem 6 faces quadradas:

- frente;
- tras;
- direita;
- esquerda;
- cima;
- baixo.

Cada face tem 4 cantos.
No codigo, cada face tem:

- uma normal, usada para iluminacao;
- quatro vertices, que sao os cantos daquela face.

Exemplo conceitual de uma face:

```text
v0 ----- v1
|        |
|        |
v3 ----- v2
```

Mas a GPU desenha triangulos, nao quadrados diretamente.
Entao cada face quadrada e dividida em 2 triangulos:

```text
triangulo 1: v0, v1, v2
triangulo 2: v0, v2, v3
```

Como o cubo tem 6 faces:

- 6 faces x 4 vertices = 24 vertices;
- 6 faces x 2 triangulos = 12 triangulos;
- 12 triangulos x 3 indices = 36 indices.

Por isso o shader de preparacao coloca `indexCount = 36u`.
Isso quer dizer: para desenhar um cubo, use 36 indices.

## Por Que Cada Face Tem Seus Proprios Vertices

Um cubo geometrico poderia ter apenas 8 cantos.
Mas aqui o codigo usa 24 vertices, porque cada face precisa de uma normal propria.

A normal e a direcao para onde a face aponta.
Ela serve para calcular a luz.

Se os 8 cantos fossem compartilhados por todas as faces, a iluminacao ficaria arredondada.
Com 24 vertices, cada face fica plana e com aparencia de cubo.

## Vertex Buffer e Index Buffer

Depois de criar a geometria, o renderizador cria dois buffers:

- `vertexBuffer`: guarda as posicoes dos vertices e as normais;
- `indexBuffer`: guarda a ordem em que os vertices formam triangulos.

Cada vertice tem 6 numeros:

- 3 para a posicao: `x`, `y`, `z`;
- 3 para a normal: `nx`, `ny`, `nz`.

Cada numero e um `float32`, com 4 bytes.
Entao cada vertice ocupa:

```text
6 floats x 4 bytes = 24 bytes
```

Por isso o pipeline usa:

```js
arrayStride: 24
```

## Instancias: Um Cubo Para Cada Celula Viva

O projeto nao cria um cubo novo manualmente para cada celula.
Ele cria uma unica geometria de cubo e manda a GPU repetir essa geometria varias vezes.

Isso se chama instancing.

O fluxo e:

1. a geometria do cubo e criada uma vez;
2. a GPU monta uma lista so com as celulas vivas;
3. cada celula viva vira uma instancia do mesmo cubo;
4. o vertex shader posiciona cada instancia no lugar certo do grid.

Isso e muito mais eficiente do que criar milhares de objetos separados em JavaScript.

## Preparacao da Renderizacao

O arquivo `src/shaders/renderPrepShader.js` prepara a lista de celulas vivas.

Ele tem dois compute shaders:

- `indirectResetShader`;
- `aliveCompactShader`.

O `indirectResetShader` zera os argumentos de desenho antes de cada frame.
Ele tambem coloca `indexCount = 36`, porque cada cubo usa 36 indices.

O `aliveCompactShader` percorre todas as celulas.
Quando encontra uma celula viva, ele adiciona essa celula no buffer `aliveCells`.

Esse buffer guarda:

- o indice da celula;
- a idade da celula nos bits mais altos.

No final, a GPU sabe exatamente quantos cubos precisa desenhar.

## Shader de Renderizacao

O arquivo `src/shaders/renderShader.js` desenha os cubos.

No vertex shader, cada instancia recebe um `instance_index`.
Esse indice diz qual celula viva esta sendo desenhada.

O shader faz:

1. pega a celula em `aliveCells[instance]`;
2. separa o indice da celula e a idade;
3. converte o indice linear para coordenadas `x`, `y`, `z`;
4. centraliza o grid no espaco 3D;
5. aplica a escala do cubo;
6. aplica a rotacao do modelo;
7. aplica a camera;
8. manda o vertice para a tela.

A linha mais importante para posicionar o cubo e esta:

```wgsl
let localPosition = centered + input.position * cubeScale;
```

Ela significa:

- `centered` e o centro da celula no grid;
- `input.position` e o formato base do cubo, indo de `-1` ate `1`;
- `cubeScale` diminui o cubo para caber dentro do espaco da celula;
- a soma coloca aquele vertice no lugar certo.

## Cores e Brilho

O fragment shader, tambem em `renderShader.js`, calcula a cor final de cada pixel do cubo.

Ele usa:

- a posicao da celula para variar a cor;
- a idade da celula para destacar celulas novas;
- uma luz direcional;
- um brilho de borda;
- uma pulsacao com seno;
- transparencia leve.

Por isso os cubos ficam com visual neon.

## Camera

A camera fica em `src/Camera.js`.

Ela usa:

- `target`: ponto para onde a camera olha;
- `distance`: distancia ate o alvo;
- `yaw`: rotacao horizontal;
- `pitch`: rotacao vertical;
- `fov`: campo de visao.

Ela calcula duas matrizes:

- a matriz de visao, que posiciona a camera;
- a matriz de perspectiva, que cria profundidade.

As duas sao multiplicadas e viram `viewProjection`.
Essa matriz e enviada para o shader para transformar o mundo 3D em tela 2D.

## Controles

Os controles ficam em `src/Controls.js`.

Eles conectam mouse, scroll e teclado na camera:

- arrastar com mouse: orbita;
- shift + arrastar: pan;
- botao do meio ou direito: pan;
- scroll: zoom;
- `W`, `A`, `S`, `D`: move a camera;
- `Q` e `E`: desce e sobe.

## Matematica

O arquivo `src/math.js` tem as funcoes matematicas usadas pelo projeto.

Ele implementa:

- soma de vetores;
- subtracao de vetores;
- escala de vetores;
- produto escalar;
- produto vetorial;
- normalizacao;
- matriz identidade;
- multiplicacao de matrizes;
- matriz de perspectiva;
- matriz `lookAt`;
- rotacoes nos eixos X, Y e Z.

A explicacao detalhada da matematica esta no arquivo `EXPLICACAO_DA_MATEMATICA.md`.

## Resumo do Frame

Em cada frame, a ordem geral e:

1. atualiza a camera;
2. roda alguns passos da simulacao;
3. compacta as celulas vivas;
4. atualiza as matrizes e uniforms;
5. desenha um cubo para cada celula viva;
6. envia tudo para a GPU.

Esse e o funcionamento completo: o JavaScript organiza os recursos, mas a GPU faz a parte pesada da simulacao e do desenho.
