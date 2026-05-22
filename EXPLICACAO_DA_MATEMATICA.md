# Explicacao da Matematica

Este arquivo explica apenas a matematica usada no projeto.
A parte de organizacao do codigo esta em `EXPLICACAO_DO_CODIGO.md`.

## Grid 3D

O mundo da simulacao e um grid com tamanho:

```text
x = largura
y = altura
z = camadas
```

No projeto atual:

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
total = 24 * 24 * 16 = 9216 celulas
```

## Indice Linear

Mesmo sendo um grid 3D, as celulas ficam guardadas em um array 1D.

Para transformar uma coordenada `(xi, yi, zi)` em indice linear:

```text
index = zi * x * y + yi * x + xi
```

Exemplo com `x = 24` e `y = 24`:

```text
index = zi * 576 + yi * 24 + xi
```

Isso funciona porque:

- uma linha tem `x` celulas;
- uma camada inteira tem `x * y` celulas;
- para chegar na camada `zi`, pulamos `zi * x * y` celulas;
- para chegar na linha `yi`, pulamos `yi * x` celulas;
- depois somamos `xi`.

## Convertendo Indice Para Coordenada

No shader de renderizacao, o caminho inverso tambem aparece.
Ele pega um indice linear e descobre `x`, `y`, `z`.

As formulas sao:

```text
plane = gridX * gridY
z = floor(index / plane)
rest = index - z * plane
y = floor(rest / gridX)
x = rest - y * gridX
```

Assim a GPU sabe em qual posicao do grid cada cubo deve aparecer.

## Regras do Jogo da Vida

Cada celula tem um estado:

```text
0 = morta
maior que 0 = viva
```

O valor maior que zero tambem representa a idade da celula.

Para cada celula, o shader conta os 8 vizinhos da mesma camada `z`:

```text
(-1, -1)  (0, -1)  (1, -1)
(-1,  0)  celula   (1,  0)
(-1,  1)  (0,  1)  (1,  1)
```

A propria celula nao entra na contagem.

As regras sao conhecidas como `B3/S23`:

```text
B3  = uma celula morta nasce com exatamente 3 vizinhos vivos
S23 = uma celula viva sobrevive com 2 ou 3 vizinhos vivos
```

Em forma de condicao:

```text
se estava viva:
  continua viva se vizinhos >= 2 e vizinhos <= 3
  caso contrario morre

se estava morta:
  nasce se vizinhos == 3
  caso contrario continua morta
```

Quando uma celula viva sobrevive, sua idade aumenta:

```text
novaIdade = min(idadeAntiga + 1, 255)
```

O limite `255` existe porque a idade e empacotada em 8 bits na renderizacao.

## Bordas Toroidais

Na contagem de vizinhos, o `x` e o `y` usam bordas que dao a volta.

Isso quer dizer:

- se passar da borda direita, volta para a esquerda;
- se passar da borda esquerda, volta para a direita;
- se passar de cima, volta para baixo;
- se passar de baixo, volta para cima.

Matematicamente isso e feito com modulo:

```text
xCorrigido = (xValor + largura) % largura
yCorrigido = (yValor + altura) % altura
```

O `+ largura` e `+ altura` evitam resultado negativo antes do modulo.

## Posicao Centralizada dos Cubos

Cada celula viva vira um cubo no espaco 3D.

Primeiro a coordenada inteira da celula e transformada em uma posicao centralizada:

```text
centered = (coord - (dims - 1) * 0.5) * spacing
```

Onde:

- `coord` e `(x, y, z)` da celula;
- `dims` e `(gridX, gridY, gridZ)`;
- `spacing` e o espaco entre os centros dos cubos.

O termo:

```text
(dims - 1) * 0.5
```

acha o meio do grid.

Exemplo em uma dimensao com `gridX = 24`:

```text
(24 - 1) * 0.5 = 11.5
```

Entao:

```text
xCentralizado = (x - 11.5) * spacing
```

Isso coloca o grid centrado em torno do zero.
Sem essa conta, o grid comecaria no canto e cresceria so para o lado positivo.

## Escala do Cubo

A geometria base do cubo usa coordenadas de `-1` ate `1`.
Isso significa que o cubo base tem lado `2`.

No shader, o tamanho e reduzido:

```text
cubeScale = spacing * 0.42
```

A posicao final de cada vertice e:

```text
localPosition = centered + inputPosition * cubeScale
```

Como `inputPosition` vai de `-1` ate `1`, o lado final do cubo fica:

```text
lado = 2 * cubeScale
lado = 2 * spacing * 0.42
lado = spacing * 0.84
```

Com `spacing = 1.08`:

```text
lado = 1.08 * 0.84 = 0.9072
```

Entao os centros dos cubos ficam separados por `1.08`, mas cada cubo tem lado `0.9072`.
Isso deixa um pequeno espaco entre eles.

## Faces, Triangulos e Indices

Um cubo tem 6 faces quadradas.
Cada quadrado e desenhado como 2 triangulos.

Entao:

```text
faces = 6
triangulosPorFace = 2
triangulos = 6 * 2 = 12
indicesPorTriangulo = 3
indices = 12 * 3 = 36
```

Por isso cada cubo usa 36 indices.

## Normais

Cada face do cubo tem uma normal.

Normal e um vetor perpendicular a face.
Exemplos:

```text
frente:   ( 0,  0,  1)
tras:     ( 0,  0, -1)
direita:  ( 1,  0,  0)
esquerda: (-1,  0,  0)
cima:     ( 0,  1,  0)
baixo:    ( 0, -1,  0)
```

Essas normais sao usadas na iluminacao.

## Produto Escalar

O produto escalar aparece na iluminacao e na camera.

Para dois vetores `a` e `b`:

```text
dot(a, b) = ax * bx + ay * by + az * bz
```

Na luz difusa, ele mede o quanto a face aponta para a luz:

```text
diffuse = max(dot(normal, light), 0)
```

Se a normal aponta na direcao da luz, o resultado e alto.
Se aponta para longe, o resultado fica perto de zero.

## Produto Vetorial

O produto vetorial cria um vetor perpendicular a dois vetores.

Para `a` e `b`:

```text
cross(a, b) = (
  ay * bz - az * by,
  az * bx - ax * bz,
  ax * by - ay * bx
)
```

Ele e usado na camera para calcular:

- direita da camera;
- cima da camera;
- direcao para frente.

## Normalizacao

Normalizar um vetor significa manter sua direcao, mas transformar seu comprimento em `1`.

O comprimento de um vetor e:

```text
length = sqrt(x*x + y*y + z*z)
```

O vetor normalizado e:

```text
normalizado = (x / length, y / length, z / length)
```

Isso e importante porque calculos de direcao, luz e camera precisam comparar direcoes sem serem afetados pelo tamanho do vetor.

## Posicao da Camera

A camera usa dois angulos:

- `yaw`: rotacao horizontal;
- `pitch`: rotacao vertical.

Ela tambem usa:

- `target`: ponto observado;
- `distance`: distancia ate o alvo.

A posicao da camera e:

```text
cp = cos(pitch)

eye.x = target.x + sin(yaw) * cp * distance
eye.y = target.y + sin(pitch) * distance
eye.z = target.z + cos(yaw) * cp * distance
```

Isso coloca a camera em uma esfera ao redor do alvo.
Quando o usuario arrasta o mouse, `yaw` e `pitch` mudam, e a camera orbita.

## Matriz LookAt

A matriz `lookAt` transforma coordenadas do mundo para o ponto de vista da camera.

Ela usa:

- `eye`: posicao da camera;
- `target`: ponto observado;
- `up`: direcao vertical do mundo.

Primeiro calcula os eixos da camera:

```text
z = normalize(eye - target)
x = normalize(cross(up, z))
y = cross(z, x)
```

Depois esses eixos formam a matriz de visao.
Os produtos escalares negativos:

```text
-dot(x, eye)
-dot(y, eye)
-dot(z, eye)
```

movem o mundo no sentido contrario da camera.
E assim que parece que a camera se move, mesmo que matematicamente quem e transformado sao os objetos.

## Matriz de Perspectiva

A perspectiva faz objetos distantes parecerem menores.

O projeto usa:

```text
f = 1 / tan(fovY / 2)
```

Esse `f` controla a abertura da camera.

Na matriz:

```text
out[0] = f / aspect
out[5] = f
```

O `aspect` e:

```text
aspect = larguraDaTela / alturaDaTela
```

Ele evita que a cena fique espremida quando a tela nao e quadrada.

## Multiplicacao de Matrizes

O projeto usa matrizes 4x4 para transformar pontos 3D.

A ordem principal na renderizacao e:

```text
posicaoFinal = viewProjection * model * posicaoLocal
```

Onde:

- `posicaoLocal` e o vertice dentro do cubo;
- `model` gira o conjunto de cubos;
- `viewProjection` aplica camera e perspectiva.

Em `src/math.js`, a multiplicacao percorre linhas e colunas para combinar duas matrizes.

## Rotacao

As rotacoes usam seno e cosseno.

Rotacao em X:

```text
y' = y * cos(angulo) - z * sin(angulo)
z' = y * sin(angulo) + z * cos(angulo)
```

Rotacao em Y:

```text
x' = x * cos(angulo) + z * sin(angulo)
z' = -x * sin(angulo) + z * cos(angulo)
```

Rotacao em Z:

```text
x' = x * cos(angulo) - y * sin(angulo)
y' = x * sin(angulo) + y * cos(angulo)
```

O projeto junta as tres rotacoes assim:

```text
rotation = rotationZ * rotationY * rotationX
```

Essa matriz e enviada para o shader como `model`.

## Cor HSV

O fragment shader escolhe cores usando a ideia de HSV:

- `hue`: matiz, ou seja, qual cor;
- `saturation`: intensidade da cor;
- `value`: brilho.

O `hue` muda conforme:

```text
hue = fract(x * 0.56 + y * 0.31 + z * 0.73 + idade * 0.9)
```

O `fract` pega apenas a parte decimal.
Isso mantem o valor entre `0` e `1`.

## Brilho Pulsante

O brilho varia com seno:

```text
pulse = 0.72 + 0.28 * sin(tempo * 3.2 + x * 8 + y * 5 + z * 4)
```

Como `sin` varia de `-1` ate `1`, o termo:

```text
0.72 + 0.28 * sin(...)
```

varia aproximadamente de:

```text
0.44 ate 1.00
```

Isso cria uma animacao suave de brilho.

## Transparencia

A transparencia tambem depende do pulso e da idade:

```text
alpha = 0.5 + pulse * 0.12 + ageGlow * 0.12
```

Celulas mais novas recebem mais brilho com `ageGlow`.

## Tempo da Simulacao

No JavaScript, a simulacao usa um acumulador de tempo.

Com velocidade `8`, o intervalo entre passos e:

```text
intervalo = 1 / 8 = 0.125 segundos
```

Cada frame soma o tempo passado:

```text
accumulator = accumulator + deltaTime
```

Enquanto o acumulador for maior que o intervalo, a simulacao executa mais um passo:

```text
while accumulator >= intervalo:
  roda um passo
  accumulator = accumulator - intervalo
```

Isso mantem a simulacao rodando em uma velocidade parecida mesmo se o FPS variar.

## Resumo Matematico

A matematica principal do projeto e:

- indice 3D para array 1D;
- contagem de vizinhos;
- regras `B3/S23`;
- centralizacao do grid em torno do zero;
- escala dos cubos;
- divisao de quadrados em triangulos;
- vetores para camera e luz;
- matrizes para rotacao, camera e perspectiva;
- seno para brilho animado;
- produto escalar para iluminacao.
