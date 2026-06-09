import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { probabilityToPoints } from "@/lib/scoring/calculator";
import SimuladorPontos from "./SimuladorPontos";

const REFERENCE_PROBS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export default function RegrasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regras do Bolão</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tudo que você precisa saber para participar e pontuar.
        </p>
      </div>

      {/* Como funciona */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Antes de cada jogo da Copa do Mundo 2026, você registra um palpite
            com o placar que espera para a partida — por exemplo, Brasil 2 × 1
            Argentina.
          </p>
          <p>
            Após o apito final, o sistema compara seu palpite com o resultado
            real e calcula quantos pontos você ganhou. Quem acumular mais pontos
            ao longo do torneio vence o bolão.
          </p>
        </CardContent>
      </Card>

      {/* Sistema de pontuação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sistema de pontuação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              A pontuação premia quem aposta em resultados menos prováveis. Os
              pontos são calculados em duas etapas:
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>
                <span className="text-foreground font-medium">
                  Pontos pelo resultado
                </span>{" "}
                — acertou quem venceu (ou empate)? Você ganha de{" "}
                <strong>1 a 13 pontos</strong>, dependendo de quão improvável
                era esse resultado segundo as odds.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Bônus de placar exato
                </span>{" "}
                — acertou o placar exato? Ganhe <strong>+5 pontos</strong>{" "}
                adicionais.
              </li>
            </ol>
            <p>
              Se você errou o resultado (apostou em vitória do Brasil e o time
              perdeu), a pontuação é <strong>zero</strong> — independente do
              placar.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 font-medium">Probabilidade do resultado</th>
                  <th className="pb-2 font-medium text-center">
                    Acertou o resultado
                  </th>
                  <th className="pb-2 font-medium text-center">
                    + placar exato
                  </th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE_PROBS.map((p) => {
                  const base = probabilityToPoints(p);
                  return (
                    <tr key={p} className="border-b last:border-0">
                      <td className="py-1.5 text-muted-foreground">
                        {Math.round(p * 100)}%
                      </td>
                      <td className="py-1.5 text-center font-medium">
                        {base} pts
                      </td>
                      <td className="py-1.5 text-center text-muted-foreground">
                        {base + 5} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Simulador */}
      <SimuladorPontos />

      {/* Deadline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prazo para palpites</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Os palpites ficam abertos até{" "}
            <span className="text-foreground font-medium">
              5 minutos antes do início de cada jogo
            </span>
            . Após esse prazo, o card de palpite é bloqueado automaticamente e
            não é mais possível editar.
          </p>
          <p>
            Você pode alterar seu palpite quantas vezes quiser enquanto o jogo
            não estiver próximo. Apenas o último palpite salvo antes do
            fechamento é considerado.
          </p>
        </CardContent>
      </Card>

      {/* Palpite de Campeão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏆 Palpite de Campeão</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Antes do início da Copa, você pode escolher qual seleção será a{" "}
            <span className="text-foreground font-medium">campeã do torneio</span>.
            Essa escolha vale <strong>+20 pontos</strong> no final — quem acertar
            garante um bônus significativo no ranking.
          </p>
          <p>
            O palpite de campeão é{" "}
            <span className="text-foreground font-medium">
              bloqueado automaticamente quando o primeiro jogo começa
            </span>
            . Enquanto o torneio não tiver iniciado, você pode alterar sua escolha
            quantas vezes quiser.
          </p>
          <p>
            Diferente dos palpites de jogos, o palpite de campeão{" "}
            <strong>não usa odds</strong> — vale um valor fixo de{" "}
            <strong>20 pontos</strong> para quem acertar, independentemente da
            seleção escolhida.
          </p>
        </CardContent>
      </Card>

      {/* Origem das odds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">De onde vêm as probabilidades</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            As probabilidades usadas no cálculo dos pontos vêm de odds de
            mercado, fornecidas pela{" "}
            <span className="text-foreground font-medium">The Odds API</span> —
            uma fonte que agrega as cotações de dezenas de casas de apostas
            esportivas ao redor do mundo.
          </p>
          <p>
            As probabilidades são atualizadas em duas janelas: aproximadamente{" "}
            <strong>24 horas</strong> e <strong>1 hora</strong> antes de cada
            jogo. Elas servem para você ter uma referência ao fazer seu palpite.
          </p>
          <p>
            O que vale para o cálculo dos pontos é sempre a probabilidade{" "}
            <strong>travada no momento em que o jogo começa</strong>. O momento
            em que você fez o palpite não influencia sua pontuação — todos que
            apostaram no mesmo resultado recebem os mesmos pontos.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
