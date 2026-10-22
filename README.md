# Trilhos Insanos — servidor inicial

Inclui o jogo HTML e um servidor Node.js sem dependências externas, com rankings semanais.

## Rodar no PC
1. Instale Node.js 18 ou mais recente.
2. Extraia a pasta do projeto.
3. Abra um terminal dentro da pasta e execute `npm start` (ou `node server.js`).
4. Abra `http://localhost:8080` no navegador.

## API
- `GET /api/health` — verifica se o servidor está ativo.
- `GET /api/leaderboards` — devolve os 10 melhores da semana por pontuação e maior tempo sem coletar moedas.
- `POST /api/runs` — recebe `{ "name": "Jogador", "score": 123, "noCoinSeconds": 45 }`.

A semana é calculada em UTC. Os resultados ficam em `data/runs.json` e são guardados no servidor, não no navegador. O servidor mantém o melhor resultado por nome em cada semana e limita requisições básicas por IP.

## Antes de publicar
Este é um backend inicial, não um serviço já hospedado na internet. Para publicação pública, use HTTPS, banco de dados persistente, moderação/limites adicionais contra resultados falsos e configure backups. O ranking atual é uma classificação casual: os resultados enviados pelo cliente podem ser adulterados por alguém que manipule o navegador.
