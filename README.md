# WebGPU Life 3D

Visualizacao 3D interativa de um automato celular Life-like feita com WebGPU e JavaScript puro.

O projeto e uma extensao 3D inspirada no Jogo da Vida de Conway, mas nao usa a regra classica `B3/S23`. A simulacao atual usa vizinhanca Moore 3D e regra `B6/S567`, processando um volume de celulas cubicas diretamente na GPU com compute shader.

## Visao Geral

- O espaco da simulacao e um grid 3D com coordenadas `x`, `y` e `z`.
- Cada celula viva e renderizada como um cubo.
- Cada celula morta nao e desenhada.
- A proxima geracao e calculada na GPU, nao em loops JavaScript na CPU.
- O renderer usa WebGPU para desenhar os cubos com perspectiva, profundidade e iluminacao.
- A versao atual usa valores fixos em `src/main.js`: grid `32x32x32`, velocidade `1` passo por segundo e rotacao automatica desligada.

## Por Que A Simulacao E 3D

Na versao 2D classica do Jogo da Vida, uma celula olha ate 8 vizinhas ao redor dela em um quadrado `3x3`.

Nesta versao, cada celula esta em uma coordenada `(x, y, z)` e olha um cubo `3x3x3` ao redor dela:

- 9 posicoes na camada abaixo;
- 8 posicoes na mesma camada, porque o centro e a propria celula;
- 9 posicoes na camada acima.

O cubo tem 27 posicoes no total. Como a posicao central e a propria celula, sobram 26 vizinhas possiveis. Portanto, uma celula pode nascer ou morrer por causa de vizinhos em `x`, `y` e `z`.

## Regras

A simulacao usa a regra Life-like 3D `B6/S567` com vizinhanca Moore 3D.

- `B6`: uma celula morta nasce com exatamente 6 vizinhos ativos.
- `S567`: uma celula viva sobrevive com 5, 6 ou 7 vizinhos ativos.
- Em qualquer outro caso, a celula fica ou se torna morta.

As bordas sao periodicas nas dimensoes `X`, `Y` e `Z`. Isso significa que, ao passar de uma borda do volume, a consulta de vizinho reaparece do lado oposto.

## WebGPU E Alto Desempenho

O projeto pode ser defendido como Programacao de Alto Desempenho porque usa paralelismo na GPU:

- `LifeSimulation3D.js` cria buffers, bind groups e um compute pipeline.
- `simulationShader.js` executa a regra de evolucao em um compute shader.
- `dispatchWorkgroups(...)` despacha varios grupos de trabalho para a GPU.
- Cada invocacao do shader calcula uma celula do grid.
- Os estados antigo e novo ficam em dois buffers de GPU, alternados pela tecnica ping-pong.
- O renderizador tambem usa compute shader para compactar a lista de celulas vivas antes do desenho indireto.

Esse modelo evita que o JavaScript percorra todas as celulas a cada geracao. O JavaScript organiza os comandos; a GPU executa o processamento massivo.

## Estrutura

```text
.
├── intdex.html
├── README.md
├── EXPLICACAO_DO_CODIGO.md
├── EXPLICACAO_DA_MATEMATICA.md
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

## Fluxo De Execucao

1. `main.js` verifica o suporte a WebGPU, cria o `device`, configura o canvas e instancia camera, controles, simulacao e renderizador.
2. `LifeSimulation3D.js` cria os buffers de estado, o buffer de parametros, os bind groups e o compute pipeline da simulacao.
3. `simulationShader.js` conta as vizinhas em 3D e calcula a proxima geracao.
4. A cada passo, a simulacao alterna entre dois buffers: um buffer e lido como estado antigo e o outro recebe o estado novo.
5. `LifeRenderer3D.js` prepara as celulas vivas e desenha cubos instanciados para representar o estado atual.

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

## Controles Ativos

- Arrastar com o mouse: rotaciona a camera.
- Scroll do mouse: zoom.
- Shift + arrastar: move a camera.
- Botao do meio ou direito + arrastar: move a camera.
- `W`, `A`, `S`, `D`: movimenta a camera.
- `Q` e `E`: desce/sobe a camera.

Observacao: existe uma barra de controles no HTML para play/pause, velocidade, reset, rotacao automatica e tamanho do grid, mas essa barra esta comentada na versao atual. Por isso, esses controles nao aparecem na interface agora; os valores fixos ficam em `src/main.js`.

## Observacoes Para O Artigo

Uma formulacao adequada e:

```text
O projeto implementa uma variacao tridimensional Life-like do Jogo da Vida, usando vizinhanca Moore 3D com 26 vizinhas e regra B6/S567. A atualizacao das celulas e executada em paralelo na GPU por meio de WebGPU compute shaders.
```

Evite chamar a simulacao de "Jogo da Vida de Conway classico em 3D", porque a regra classica `B3/S23` nao e a regra usada no codigo atual.
