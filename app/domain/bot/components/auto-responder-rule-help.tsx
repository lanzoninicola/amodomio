import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function RuleHelp() {
  return (
    <Alert className="mb-6 bg-slate-100">
      <Info className="h-4 w-4" />
      <AlertTitle>Como funciona uma regra</AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>
          Cada regra verifica se a mensagem recebida contém o{" "}
          <span className="font-semibold" >gatilho</span> definido.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-semibold" >Gatilho</span>: texto simples ou expressão regular (Regex).
          </li>
          <li>
            <span className="font-semibold" >Regex</span>: marque se o gatilho deve ser interpretado como expressão regular.
          </li>
          <li>
            <span className="font-semibold" >Prioridade</span>: menor valor = maior prioridade (útil quando várias regras podem corresponder).
          </li>
          <li>
            <span className="font-semibold" >Janela (De/Até)</span>: período opcional em que a regra vale. Fora desse intervalo ela é ignorada.
          </li>
          <li>
            <span className="font-semibold" >Ativa</span>: se desmarcada, a regra não é aplicada.
          </li>
          <li>
            <span className="font-semibold" >Resposta</span>: mensagem enviada automaticamente quando a regra dispara.
          </li>
        </ul>
        <p className="pt-2">
          Exemplo: se o gatilho for <code>oi</code> e estiver ativa, sempre que o cliente mandar "oi" a resposta cadastrada será enviada.
        </p>
      </AlertDescription>
    </Alert>
  );
}
