# Explicacao da Matematica

Este documento explica a matematica do projeto com mais contexto.
O objetivo e responder:

- o que cada conta significa;
- para que ela serve;
- onde ela aparece no codigo;
- como ela ajuda a transformar celulas em cubos na tela.

## 1. A Ideia Matematica Do Projeto

O projeto mistura tres tipos de matematica:

1. matematica de grid;
2. matematica do Jogo da Vida;
3. matematica 3D.

Cada uma resolve um problema diferente.

```text
grid
  onde cada celula esta?

Jogo da Vida
  uma celula nasce, vive ou morre?

3D
  onde o cubo aparece na tela e com qual luz?
```

## 2. Grid 3D

O mundo da simulacao e uma caixa dividida em celulas.

O tamanho e:

```text
x = largura
y = altura
z = quantidade de camadas
```

No codigo atual:

```js
const DEFAULT_GRID_DIMENSIONS = { x: 24, y: 24, z: 16 };
```

Entao:

```text
x = 24
y = 24
z = 16
```

O total de celulas e:

```text
total = x * y * z
```

Com os valores atuais:

```text
total = 24 * 24 * 16
total = 9216
```

Ou seja, existem 9216 posicoes possiveis.

## 3. Coordenada 3D

Cada celula pode ser descrita por uma coordenada:

```text
(xi, yi, zi)
```

Exemplo:

```text
(0, 0, 0)
```

Essa e a primeira celula.

Outro exemplo:

```text
(5, 10, 2)
```

Isso significa:

- coluna 5;
- linha 10;
- camada 2.

Os valores validos sao:

```text
xi: 0 ate x - 1
yi: 0 ate y - 1
zi: 0 ate z - 1
```

Para `24 x 24 x 16`:

```text
xi: 0 ate 23
yi: 0 ate 23
zi: 0 ate 15
```

## 4. Por Que O Grid 3D Vira Um Array 1D

Computadores guardam memoria como uma fila de posicoes.
Mesmo que a gente imagine um grid 3D, na memoria ele fica como uma lista.

Exemplo visual:

```text
grid 3D imaginado:
camada 0, camada 1, camada 2...

memoria real:
[0, 1, 2, 3, 4, 5, 6, ...]
```

Por isso precisamos converter:

```text
(x, y, z) -> index
```

## 5. Convertendo Coordenada Para Indice

A formula usada e:

```text
index = zi * largura * altura + yi * largura + xi
```

No codigo:

```wgsl
let index = cell.z * params.grid.x * params.grid.y + cell.y * params.grid.x + cell.x;
```

### Por Que Essa Formula Funciona

Uma linha tem `largura` celulas.

Uma camada inteira tem:

```text
largura * altura
```

Para chegar na camada `zi`, pulamos:

```text
zi * largura * altura
```

Para chegar na linha `yi` dentro dessa camada, pulamos:

```text
yi * largura
```

Depois somamos `xi`, que e a coluna.

### Exemplo

Com:

```text
largura = 24
altura = 24
xi = 5
yi = 10
zi = 2
```

Aplicando:

```text
index = 2 * 24 * 24 + 10 * 24 + 5
index = 2 * 576 + 240 + 5
index = 1152 + 240 + 5
index = 1397
```

Entao a celula `(5, 10, 2)` fica na posicao `1397` do array.

## 6. Convertendo Indice Para Coordenada

Na renderizacao acontece o contrario:

```text
index -> (x, y, z)
```

Isso aparece em `renderShader.js`, na funcao `cellCoord`.

As formulas sao:

```text
plane = largura * altura
z = floor(index / plane)
rest = index - z * plane
y = floor(rest / largura)
x = rest - y * largura
```

### Exemplo Com Index 1397

```text
plane = 24 * 24 = 576
z = floor(1397 / 576) = 2
rest = 1397 - 2 * 576 = 245
y = floor(245 / 24) = 10
x = 245 - 10 * 24 = 5
```

Resultado:

```text
(5, 10, 2)
```

Voltamos para a coordenada original.

## 7. Estado Da Celula

Cada celula guarda um numero.

```text
0      = morta
1..255 = viva
```

Se a celula esta viva, o numero representa idade.

Exemplo:

```text
0 = morta
1 = nasceu agora
2 = sobreviveu 1 passo
3 = sobreviveu 2 passos
```

No shader:

```wgsl
let age = stateIn[index];
let alive = age > 0u;
```

Se `age > 0`, a celula esta viva.

## 8. Vizinhos No Jogo Da Vida

Cada celula olha para as 8 posicoes ao redor dela.

Imagine a celula no centro:

```text
(-1,-1)  (0,-1)  (1,-1)
(-1, 0)  centro  (1, 0)
(-1, 1)  (0, 1)  (1, 1)
```

Sao 9 posicoes no quadrado, mas o centro nao conta.
Entao sobram 8 vizinhos.

No shader:

```wgsl
for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
  for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
    if (dx == 0i && dy == 0i) {
      continue;
    }
```

`continue` pula a propria celula.

## 9. Por Que So Conta Na Mesma Camada Z

O projeto tem varias camadas `z`, mas a regra conta vizinhos usando o mesmo `z`.

No shader:

```wgsl
activeNeighbors = activeNeighbors + cellActive(cx + dx, cy + dy, cz);
```

Repare que `cz` nao muda.

Isso significa:

```text
a camada 0 evolui como um tabuleiro 2D
a camada 1 evolui como outro tabuleiro 2D
a camada 2 evolui como outro tabuleiro 2D
...
```

Visualmente fica 3D porque as camadas sao empilhadas.
Matematicamente, cada camada segue o Conway 2D classico.

## 10. Bordas Toroidais

Quando uma celula esta na borda, ela ainda precisa ter vizinhos.

O projeto usa bordas que dao a volta.

Exemplo em uma linha com largura 24:

```text
se x = -1, vira 23
se x = 24, vira 0
```

Isso parece um mapa que fecha em si mesmo.
O nome matematico e toroide.

No shader:

```wgsl
let x = (xValue + gx) % gx;
let y = (yValue + gy) % gy;
```

O operador `%` pega o resto da divisao.

### Exemplo

Se `gx = 24` e `xValue = -1`:

```text
x = (-1 + 24) % 24
x = 23 % 24
x = 23
```

Se `xValue = 24`:

```text
x = (24 + 24) % 24
x = 48 % 24
x = 0
```

## 11. Regras B3/S23

O Jogo da Vida classico usa a regra chamada `B3/S23`.

Ela significa:

```text
B3
  Birth
  uma celula morta nasce com exatamente 3 vizinhos vivos

S23
  Survival
  uma celula viva sobrevive com 2 ou 3 vizinhos vivos
```

No JavaScript:

```js
const DEFAULT_RULES = {
  birth: 3,
  surviveMin: 2,
  surviveMax: 3,
};
```

No shader:

```wgsl
let born = activeNeighbors == params.rules.x;
let survives = activeNeighbors >= params.rules.y && activeNeighbors <= params.rules.z;
```

## 12. Formula Da Atualizacao

Se a celula esta viva:

```wgsl
stateOut[index] = select(0u, min(age + 1u, 255u), survives);
```

`select(a, b, condicao)` em WGSL funciona assim:

```text
se condicao for falsa, retorna a
se condicao for verdadeira, retorna b
```

Entao:

```text
se nao sobrevive:
  novo estado = 0

se sobrevive:
  novo estado = min(idade + 1, 255)
```

Se a celula esta morta:

```wgsl
stateOut[index] = select(0u, 1u, born);
```

Entao:

```text
se nao nasce:
  novo estado = 0

se nasce:
  novo estado = 1
```

## 13. Por Que A Idade Vai Ate 255

Na compactacao, idade e indice sao colocados no mesmo numero:

```wgsl
aliveCells[slot] = (age << 24u) | index;
```

Um `u32` tem 32 bits.

O projeto divide assim:

```text
8 bits altos  -> idade
24 bits baixos -> indice da celula
```

8 bits conseguem guardar valores de:

```text
0 ate 255
```

Por isso a idade fica limitada em 255.

## 14. Empacotamento De Bits

Vamos separar a ideia:

```text
age << 24
```

Isso move a idade para os 8 bits mais altos.

Depois:

```text
| index
```

O operador `|` combina idade e indice no mesmo numero.

Na renderizacao, o shader desfaz:

```wgsl
let cellIndex = packedCell & 0x00ffffffu;
let age = f32(packedCell >> 24u) / 255.0;
```

`& 0x00ffffff` pega so os 24 bits baixos.

`>> 24` move os 8 bits altos de volta para baixo.

Depois divide por 255 para transformar idade em valor entre 0 e 1.

## 15. Do Grid Para O Mundo 3D

Depois que sabemos a coordenada da celula, precisamos transformar isso em
posicao 3D.

No shader:

```wgsl
let centered = (vec3f(coord) - (dims - vec3f(1.0)) * 0.5) * spacing;
```

Essa linha centraliza o grid.

## 16. Por Que Centralizar

Se usasse a coordenada diretamente, o grid iria de:

```text
x = 0 ate 23
y = 0 ate 23
z = 0 ate 15
```

Tudo ficaria no lado positivo do mundo.

Centralizar significa fazer o grid ficar ao redor do zero:

```text
x negativo ... 0 ... x positivo
y negativo ... 0 ... y positivo
z negativo ... 0 ... z positivo
```

Isso facilita rotacao e camera.

## 17. Formula Da Centralizacao

Em uma dimensao:

```text
centralizado = (coordenada - (tamanho - 1) * 0.5) * spacing
```

Para `x = 24`:

```text
meio = (24 - 1) * 0.5
meio = 11.5
```

Entao:

```text
xCentralizado = (x - 11.5) * spacing
```

Se `x = 0`:

```text
(0 - 11.5) * 1.08 = -12.42
```

Se `x = 23`:

```text
(23 - 11.5) * 1.08 = 12.42
```

O grid fica equilibrado em volta do zero.

## 18. Espacamento Entre Cubos

No renderizador:

```js
uniforms.set([x, y, z, 1.08], 32);
```

O valor `1.08` e o `spacing`.

Ele define a distancia entre os centros das celulas.

Se duas celulas vizinhas estao lado a lado, seus centros ficam separados por
`1.08` unidades no mundo 3D.

## 19. Tamanho Do Cubo

No shader:

```wgsl
let cubeScale = spacing * 0.42;
```

A geometria base do cubo vai de `-1` ate `1`.
Entao o tamanho base do lado e `2`.

Quando multiplica por `cubeScale`, o lado final fica:

```text
lado = 2 * cubeScale
lado = 2 * spacing * 0.42
lado = spacing * 0.84
```

Com `spacing = 1.08`:

```text
lado = 1.08 * 0.84
lado = 0.9072
```

Como os centros ficam a `1.08` de distancia e o cubo tem lado `0.9072`, sobra
um pequeno espaco entre cubos.

## 20. Posicao Final Do Vertice Do Cubo

A linha:

```wgsl
let localPosition = centered + input.position * cubeScale;
```

faz a soma de:

```text
centro da celula + formato do cubo reduzido
```

Exemplo em uma dimensao:

```text
centro = 10
vertice local = -1
cubeScale = 0.4536

posicao = 10 + (-1 * 0.4536)
posicao = 9.5464
```

Outro vertice:

```text
centro = 10
vertice local = 1

posicao = 10 + (1 * 0.4536)
posicao = 10.4536
```

Assim o cubo fica ao redor do centro da celula.

## 21. Quadrados, Triangulos E Cubos

A GPU desenha triangulos.
Mesmo quando queremos um quadrado, precisamos montar esse quadrado com dois
triangulos.

Uma face:

```text
v0 ----- v1
|      / |
|    /   |
|  /     |
v3 ----- v2
```

Triangulos:

```text
v0, v1, v2
v0, v2, v3
```

Um cubo tem:

```text
6 faces
2 triangulos por face
3 indices por triangulo
```

Logo:

```text
6 * 2 * 3 = 36 indices
```

Por isso o draw indireto usa `indexCount = 36`.

## 22. Vetores 3D

Um vetor 3D tem tres componentes:

```text
[x, y, z]
```

Ele pode representar:

- posicao;
- direcao;
- velocidade;
- eixo;
- normal de uma face.

No projeto, vetores aparecem em camera, luz, normais e posicoes.

## 23. Soma De Vetores

No arquivo `math.js`:

```js
export function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
```

Serve para deslocar uma posicao.

Exemplo:

```text
a = [10, 0, 0]
b = [0, 5, 0]
a + b = [10, 5, 0]
```

Na camera, isso ajuda a mover o alvo.

## 24. Subtracao De Vetores

```js
export function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
```

Serve para descobrir a direcao de um ponto ate outro.

Exemplo:

```text
target = [0, 0, 0]
eye = [0, 0, 10]

target - eye = [0, 0, -10]
```

Isso aponta da camera para o alvo.

## 25. Escala De Vetor

```js
export function scale3(v, amount) {
  return [v[0] * amount, v[1] * amount, v[2] * amount];
}
```

Serve para aumentar ou diminuir um movimento.

Exemplo:

```text
direcao = [1, 0, 0]
amount = 5
resultado = [5, 0, 0]
```

## 26. Comprimento De Vetor

O comprimento de um vetor e:

```text
sqrt(x*x + y*y + z*z)
```

No codigo:

```js
Math.hypot(v[0], v[1], v[2])
```

Exemplo:

```text
v = [3, 4, 0]
comprimento = sqrt(3*3 + 4*4)
comprimento = sqrt(9 + 16)
comprimento = 5
```

## 27. Normalizacao

Normalizar e transformar um vetor em comprimento 1.

```text
normalizado = vetor / comprimento
```

Exemplo:

```text
v = [0, 0, 10]
comprimento = 10
normalizado = [0, 0, 1]
```

Isso mantem a direcao, mas remove o tamanho.

Serve para:

- direcao da camera;
- direcao da luz;
- normais;
- produto escalar correto.

## 28. Produto Escalar

No codigo:

```js
export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
```

O produto escalar mede o quanto dois vetores apontam para a mesma direcao.

Resultados importantes:

```text
1  -> mesma direcao
0  -> perpendicular
-1 -> direcoes opostas
```

Na iluminacao:

```wgsl
let diffuse = max(dot(n, light), 0.0);
```

Se a face aponta para a luz, fica mais clara.
Se aponta para longe, fica escura.

## 29. Produto Vetorial

No codigo:

```js
export function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
```

O produto vetorial cria um vetor perpendicular a dois vetores.

Ele e usado na camera para criar os eixos:

- direita;
- cima;
- frente.

Exemplo conceitual:

```text
frente x cima = direita
```

## 30. Matriz 4x4

Uma matriz 4x4 e uma tabela com 16 numeros.

Ela serve para transformar pontos 3D.

Com matriz, conseguimos fazer:

- rotacao;
- translacao;
- escala;
- camera;
- perspectiva.

No projeto, as matrizes sao `Float32Array(16)`.

## 31. Por Que Usar 4x4 Em 3D

Um ponto 3D tem:

```text
x, y, z
```

Mas em graficos 3D usamos:

```text
x, y, z, w
```

Esse quarto valor permite que matrizes representem perspectiva e translacao.

No shader:

```wgsl
vec4f(localPosition, 1.0)
```

O `1.0` e o `w`.

## 32. Matriz Identidade

A matriz identidade nao altera nada.

E como multiplicar por 1.

```text
1 0 0 0
0 1 0 0
0 0 1 0
0 0 0 1
```

Ela aparece em `mat4Identity()`.

Serve como ponto de partida para outras matrizes.

## 33. Multiplicacao De Matrizes

Quando multiplicamos matrizes, combinamos transformacoes.

No projeto:

```js
return mat4Multiply(projection, view);
```

Isso combina:

```text
projecao * visao
```

Na renderizacao:

```wgsl
let world = uniforms.model * vec4f(localPosition, 1.0);
output.position = uniforms.viewProjection * world;
```

Fluxo:

```text
posicao local
  -> model
  -> posicao no mundo
  -> viewProjection
  -> posicao na tela
```

## 34. Rotacao Com Seno E Cosseno

Rotacao usa seno e cosseno porque eles descrevem movimento circular.

No arquivo `math.js`, existem:

- `mat4RotationX`;
- `mat4RotationY`;
- `mat4RotationZ`;
- `mat4RotationXYZ`.

### Rotacao Em X

Gira em volta do eixo X.

O X fica igual.
Y e Z mudam.

### Rotacao Em Y

Gira em volta do eixo Y.

O Y fica igual.
X e Z mudam.

### Rotacao Em Z

Gira em volta do eixo Z.

O Z fica igual.
X e Y mudam.

No renderizador:

```js
const model = mat4RotationXYZ(this.sceneRotation[0], this.sceneRotation[1], this.sceneRotation[2]);
```

Essa matriz gira a cena inteira.

## 35. Camera Orbital

A camera gira em volta de um alvo.

Ela guarda:

```text
target
distance
yaw
pitch
```

`yaw` e a rotacao horizontal.
`pitch` e a rotacao vertical.

No codigo:

```js
const cp = Math.cos(this.pitch);
return [
  this.target[0] + Math.sin(this.yaw) * cp * this.distance,
  this.target[1] + Math.sin(this.pitch) * this.distance,
  this.target[2] + Math.cos(this.yaw) * cp * this.distance,
];
```

Essa formula coloca a camera em uma esfera ao redor do alvo.

## 36. LookAt

`lookAt` cria a matriz de visao.

Ela responde:

```text
se a camera esta em eye e olha para target, como transformar o mundo?
```

No codigo:

```js
const z = normalize3(sub3(eye, target));
const x = normalize3(cross3(up, z));
const y = cross3(z, x);
```

Esses sao os eixos da camera:

- `z`: direcao para tras da camera;
- `x`: direita da camera;
- `y`: cima da camera.

Depois:

```js
out[12] = -dot3(x, eye);
out[13] = -dot3(y, eye);
out[14] = -dot3(z, eye);
```

Essas linhas colocam a posicao da camera dentro da matriz.

## 37. Perspectiva

Perspectiva faz objetos longe parecerem menores.

No codigo:

```js
const f = 1 / Math.tan(fovY / 2);
```

`fovY` e o campo de visao vertical.

Se o FOV e maior, a camera parece mais aberta.
Se o FOV e menor, parece mais fechada.

A matriz tambem usa:

```js
aspect = largura / altura
near
far
```

`aspect` evita imagem espremida.
`near` e a distancia minima visivel.
`far` e a distancia maxima visivel.

## 38. Luz Direcional

No renderizador, a luz e enviada assim:

```js
uniforms.set([-0.38, 0.72, 0.54, 0], 36);
```

Isso e uma direcao.

No fragment shader:

```wgsl
let light = normalize(-uniforms.lightDirection.xyz);
let diffuse = max(dot(n, light), 0.0);
```

`n` e a normal da face.

Se a normal aponta para a luz, o produto escalar e maior.
Se aponta para longe, fica menor.

## 39. Brilho De Borda

O brilho de borda usa:

```wgsl
let rim = pow(1.0 - clamp(dot(n, viewDirection), 0.0, 1.0), 2.2);
```

Ideia:

- quando a face esta virada diretamente para a camera, a borda brilha menos;
- quando a face esta de lado, a borda brilha mais.

Isso ajuda a dar aparencia neon.

## 40. Cor HSV

O shader usa uma funcao `hsvToRgb`.

HSV e outra forma de pensar cor:

- Hue: qual cor;
- Saturation: intensidade;
- Value: brilho.

O hue e calculado com:

```wgsl
let hue = fract(seed.x * 0.56 + seed.y * 0.31 + seed.z * 0.73 + input.age * 0.9);
```

`seed` vem da posicao da celula.
`input.age` vem da idade.

`fract` pega so a parte decimal, mantendo o valor entre 0 e 1.

## 41. Pulso Com Seno

O brilho pulsa com:

```wgsl
let pulse = 0.72 + 0.28 * sin(uniforms.time.x * 3.2 + seed.x * 8.0 + seed.y * 5.0 + seed.z * 4.0);
```

O seno varia entre -1 e 1.

Entao:

```text
0.72 + 0.28 * sin(...)
```

varia entre:

```text
0.44 e 1.00
```

Isso cria uma oscilacao suave.

## 42. Transparencia

O alpha e:

```wgsl
let alpha = 0.5 + pulse * 0.12 + ageGlow * 0.12;
```

Ele depende de:

- transparencia base;
- pulso;
- brilho por idade.

Depois o pipeline mistura a cor usando blend.

## 43. Tempo Da Simulacao

No `main.js`, a simulacao nao roda exatamente uma vez por frame.
Ela roda de acordo com tempo acumulado.

```js
accumulator += deltaTime;
const interval = 1 / speed;
```

Com `speed = 8`:

```text
interval = 0.125 segundos
```

Se o acumulador passa desse valor, roda um passo.

Isso separa:

```text
FPS da tela
velocidade da simulacao
```

Assim a simulacao nao fica muito rapida so porque o monitor tem FPS maior.

## 44. Resumo Das Formulas Mais Importantes

### Total De Celulas

```text
total = x * y * z
```

### Coordenada Para Indice

```text
index = z * largura * altura + y * largura + x
```

### Indice Para Coordenada

```text
plane = largura * altura
z = floor(index / plane)
rest = index - z * plane
y = floor(rest / largura)
x = rest - y * largura
```

### Regra De Vida

```text
morta nasce se vizinhos == 3
viva sobrevive se vizinhos == 2 ou vizinhos == 3
```

### Centralizacao

```text
centered = (coord - (dims - 1) * 0.5) * spacing
```

### Tamanho Do Cubo

```text
cubeScale = spacing * 0.42
lado = 2 * cubeScale
```

### Posicao Do Vertice

```text
localPosition = centered + inputPosition * cubeScale
```

### Pipeline 3D

```text
posicaoLocal -> model -> mundo -> viewProjection -> tela
```

## 45. Resumo Em Uma Frase

A matematica do projeto pega uma celula em um array, descobre sua posicao no
grid, aplica regras de vida e morte, transforma celulas vivas em cubos 3D,
projeta esses cubos na tela e calcula cor, luz e brilho para cada pixel.
