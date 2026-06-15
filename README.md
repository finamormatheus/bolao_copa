# Bolão Copa do Mundo 2026

Aplicação web de bolão para a Copa do Mundo 2026. Participantes fazem palpites nos placares dos jogos, escolhem o campeão do torneio e disputam um ranking em tempo real dentro de grupos privados.

## Funcionalidades

- **Palpites de placar** — usuários apostam no placar exato de cada partida até 5 minutos antes do apito inicial
- **Palpite de campeão** — cada participante escolhe o vencedor do torneio antes do início da competição
- **Sistema de pontuação por odds** — acertar um resultado improvável vale mais pontos do que acertar o favorito; acertar o placar exato dá bônus adicional
- **Ranking em tempo real** — pontuação atualizada durante os jogos com pontos provisórios, incluindo indicador de variação de posição (↑↓)
- **Grupos privados** — múltiplos bolões independentes dentro do mesmo banco de dados; cada grupo enxerga apenas seus próprios participantes

## Sistema de Pontuação

- Acertar o **resultado** (vitória/empate/derrota) vale pontos baseados nas odds de quando o jogo começou — quanto menos provável o resultado, mais pontos
- Acertar o **placar exato** dá um bônus adicional fixo
- Resultado errado: zero pontos
- O **palpite de campeão** é pontuado separadamente ao fim do torneio