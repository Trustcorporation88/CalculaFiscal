import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CENARIOS, DESCRICAO_CENARIOS } from '@calculafiscal/regras/cenarios';
import {
  calcular,
  CONFIG_INICIAL,
  pendenciasConfig,
  ROTULO_REGIME,
  ROTULO_TRATAMENTO,
  type ConfigEmpresa,
  type RegimeApp,
  type ResultadoAnoApp,
  type Tratamento,
} from './calculo';
import { CORES, COR_IMPOSTO, COR_STATUS, porcento, reais, ROTULO_STATUS } from './formato';

const CHAVE_CONFIG = 'calculadora-fiscal:config:v1';
const CHAVE_ULTIMO = 'calculadora-fiscal:ultimo:v1';

/** Guarda só no aparelho: nada digitado sai do celular. */
async function lerJson<T>(chave: string, padrao: T): Promise<T> {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    return bruto ? { ...padrao, ...(JSON.parse(bruto) as Partial<T>) } : padrao;
  } catch {
    return padrao;
  }
}

function gravarJson(chave: string, valor: unknown) {
  AsyncStorage.setItem(chave, JSON.stringify(valor)).catch(() => undefined);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Raiz />
    </SafeAreaProvider>
  );
}

function Raiz() {
  const [carregado, setCarregado] = useState(false);
  const [config, setConfig] = useState<ConfigEmpresa>(CONFIG_INICIAL);
  const [tela, setTela] = useState<'calculadora' | 'empresa'>('calculadora');
  const [custo, setCusto] = useState('');
  const [margem, setMargem] = useState('');
  const [ano, setAno] = useState(2026);

  useEffect(() => {
    void (async () => {
      const c = await lerJson(CHAVE_CONFIG, CONFIG_INICIAL);
      const u = await lerJson(CHAVE_ULTIMO, { custo: '', margem: '', ano: 2026 });
      setConfig(c);
      setCusto(u.custo);
      setMargem(u.margem);
      setAno(u.ano);
      if (pendenciasConfig(c).length > 0) setTela('empresa');
      setCarregado(true);
    })();
  }, []);

  useEffect(() => {
    if (carregado) gravarJson(CHAVE_ULTIMO, { custo, margem, ano });
  }, [carregado, custo, margem, ano]);

  if (!carregado) return <SafeAreaView style={estilos.tela} />;

  return (
    <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
      <View style={estilos.topo}>
        <View style={estilos.marca}>
          <Image
            source={require('../assets/icon.png')}
            style={estilos.simbolo}
            accessibilityIgnoresInvertColors
          />
          <Text style={estilos.marcaTexto}>
            Calculadora <Text style={estilos.negrito}>Fiscal</Text>
          </Text>
        </View>
        <Pressable
          onPress={() => setTela(tela === 'empresa' ? 'calculadora' : 'empresa')}
          style={estilos.botaoTopo}
          accessibilityRole="button"
        >
          <Text style={estilos.botaoTopoTexto}>{tela === 'empresa' ? 'Calcular' : 'Empresa'}</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={estilos.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {tela === 'empresa' ? (
          <TelaEmpresa
            inicial={config}
            aoSalvar={(c) => {
              setConfig(c);
              gravarJson(CHAVE_CONFIG, c);
              setTela('calculadora');
            }}
          />
        ) : (
          <TelaCalculadora
            config={config}
            custo={custo}
            margem={margem}
            ano={ano}
            setCusto={setCusto}
            setMargem={setMargem}
            setAno={setAno}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Campo(props: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  sufixo?: string;
  grande?: boolean;
  dica?: string;
}) {
  return (
    <View style={[estilos.campo, props.grande && estilos.campoGrande]}>
      <Text style={estilos.rotulo}>{props.rotulo}</Text>
      <View style={estilos.entradaLinha}>
        <TextInput
          value={props.valor}
          onChangeText={props.aoMudar}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={CORES.borda}
          style={[estilos.entrada, props.grande && estilos.entradaGrande]}
          accessibilityLabel={props.rotulo}
        />
        {props.sufixo && <Text style={estilos.sufixo}>{props.sufixo}</Text>}
      </View>
      {props.dica && <Text style={estilos.dica}>{props.dica}</Text>}
    </View>
  );
}

function TelaCalculadora(props: {
  config: ConfigEmpresa;
  custo: string;
  margem: string;
  ano: number;
  setCusto: (v: string) => void;
  setMargem: (v: string) => void;
  setAno: (v: number) => void;
}) {
  const calculo = useMemo(
    () => calcular(props.config, props.custo, props.margem),
    [props.config, props.custo, props.margem],
  );
  const atual = calculo.ok ? calculo.anos.find((a) => a.ano === props.ano) : undefined;

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <View style={estilos.linhaCampos}>
        <Campo
          rotulo="Custo do produto"
          valor={props.custo}
          aoMudar={props.setCusto}
          sufixo="R$"
          grande
          dica="Já sem o imposto que você recupera"
        />
        <Campo rotulo="Margem" valor={props.margem} aoMudar={props.setMargem} sufixo="%" grande />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.anos}>
        {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((a) => (
          <Pressable
            key={a}
            onPress={() => props.setAno(a)}
            style={[estilos.ano, a === props.ano && estilos.anoAtivo]}
            accessibilityRole="button"
            accessibilityState={{ selected: a === props.ano }}
          >
            <Text style={[estilos.anoTexto, a === props.ano && estilos.anoTextoAtivo]}>{a}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!calculo.ok ? (
        <View style={estilos.aviso}>
          <Text style={estilos.avisoTexto}>{calculo.erro}</Text>
        </View>
      ) : atual ? (
        <Resultado r={atual} />
      ) : null}

      {calculo.ok && (
        <View style={estilos.cartao}>
          <Text style={estilos.tituloCartao}>Linha do tempo</Text>
          {calculo.anos.map((a) => (
            <Pressable
              key={a.ano}
              onPress={() => props.setAno(a.ano)}
              style={[estilos.linhaTempo, a.ano === props.ano && estilos.linhaTempoAtiva]}
            >
              <Text style={estilos.linhaAno}>{a.ano}</Text>
              <View style={[estilos.ponto, { backgroundColor: COR_STATUS[a.status] }]} />
              <Text style={estilos.linhaImpostos}>
                {a.situacao === 'calculado' ? `impostos ${porcento(a.pesoImpostos)}` : 'pendente'}
              </Text>
              <Text style={estilos.linhaValor}>
                {a.situacao === 'calculado' ? reais(a.clientePaga) : '—'}
              </Text>
            </Pressable>
          ))}
          <Text style={estilos.nota}>{calculo.versao}</Text>
        </View>
      )}

      <Text style={estilos.nota}>
        {ROTULO_REGIME[props.config.regime]} · {ROTULO_TRATAMENTO[props.config.tratamento]} ·{' '}
        {DESCRICAO_CENARIOS[props.config.cenario]}. Simulação para apoio à decisão; não substitui o
        contador. Nada digitado sai do celular.
      </Text>
    </ScrollView>
  );
}

function Resultado({ r }: { r: ResultadoAnoApp }) {
  if (r.situacao === 'pendente') {
    return (
      <View style={estilos.aviso}>
        <Text style={estilos.avisoTexto}>
          {r.ano}: dado pendente. {r.motivo}
        </Text>
      </View>
    );
  }
  const partes = [
    { nome: 'Custo', valor: r.custo, cor: CORES.custo },
    ...r.impostos.map((i) => ({
      nome: i.sigla,
      valor: i.valor,
      cor: COR_IMPOSTO[i.sigla] ?? CORES.erro,
    })),
    { nome: 'Despesas', valor: r.despesas, cor: CORES.despesas },
    { nome: 'Lucro', valor: r.lucro, cor: CORES.lucro },
  ];
  const total = Number(r.clientePaga);

  return (
    <View style={estilos.cartaoDestaque}>
      <View style={estilos.linhaStatus}>
        <Text style={estilos.rotuloClaro}>Preço de venda em {r.ano}</Text>
        <View style={[estilos.selo, { borderColor: COR_STATUS[r.status] }]}>
          <Text style={[estilos.seloTexto, { color: COR_STATUS[r.status] }]}>
            {ROTULO_STATUS[r.status]}
          </Text>
        </View>
      </View>
      <Text style={estilos.preco}>{reais(r.clientePaga)}</Text>
      <Text style={estilos.sugestao}>Preço sugerido: {reais(r.sugerido)}</Text>

      <View style={estilos.barra} accessibilityLabel="Composição do preço">
        {partes.map((p) => (
          <View
            key={p.nome}
            style={{ flex: Math.max(Number(p.valor), 0) / total, backgroundColor: p.cor }}
          />
        ))}
      </View>

      <View style={estilos.impostosDestaque}>
        <Text style={estilos.impostosTitulo}>Impostos no preço</Text>
        <Text style={estilos.impostosValor}>
          {reais(r.totalImpostos)} · {porcento(r.pesoImpostos)}
        </Text>
      </View>

      {partes.map((p) => {
        const imposto = p.nome !== 'Custo' && p.nome !== 'Despesas' && p.nome !== 'Lucro';
        return (
          <View key={p.nome} style={estilos.linhaParte}>
            <View style={[estilos.ponto, { backgroundColor: p.cor }]} />
            <Text style={[estilos.parteNome, imposto && estilos.parteImposto]}>{p.nome}</Text>
            <Text style={[estilos.parteValor, imposto && estilos.parteImposto]}>
              {reais(p.valor)}
            </Text>
          </View>
        );
      })}
      <Text style={estilos.margens}>
        Margem sobre o preço {porcento(r.margemSobrePreco)} · sobre a receita líquida{' '}
        {porcento(r.margemSobreReceita)}
      </Text>
    </View>
  );
}

function Opcoes<T extends string>(props: {
  rotulo: string;
  valor: T;
  opcoes: readonly { valor: T; texto: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{props.rotulo}</Text>
      <View style={estilos.opcoes}>
        {props.opcoes.map((o) => (
          <Pressable
            key={o.valor}
            onPress={() => props.aoMudar(o.valor)}
            style={[estilos.opcao, o.valor === props.valor && estilos.opcaoAtiva]}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.valor === props.valor }}
          >
            <Text style={[estilos.opcaoTexto, o.valor === props.valor && estilos.opcaoTextoAtiva]}>
              {o.texto}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TelaEmpresa({
  inicial,
  aoSalvar,
}: {
  inicial: ConfigEmpresa;
  aoSalvar: (c: ConfigEmpresa) => void;
}) {
  const [c, setC] = useState<ConfigEmpresa>(inicial);
  const muda = <K extends keyof ConfigEmpresa>(k: K, v: ConfigEmpresa[K]) => setC({ ...c, [k]: v });
  const faltas = pendenciasConfig(c);

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={estilos.titulo}>Sua empresa</Text>
      <Text style={estilos.dica}>
        Preencha uma vez. Fica guardado só neste celular e vale para todos os cálculos.
      </Text>

      <Opcoes<RegimeApp>
        rotulo="Regime"
        valor={c.regime}
        opcoes={(Object.keys(ROTULO_REGIME) as RegimeApp[]).map((r) => ({
          valor: r,
          texto: ROTULO_REGIME[r],
        }))}
        aoMudar={(v) => muda('regime', v)}
      />

      {c.regime === 'SIMPLES_DAS' ? (
        <Campo
          rotulo="Alíquota efetiva do DAS"
          valor={c.aliquotaDas}
          aoMudar={(v) => muda('aliquotaDas', v)}
          sufixo="%"
        />
      ) : (
        <>
          <Campo
            rotulo="ICMS na venda"
            valor={c.icmsVenda}
            aoMudar={(v) => muda('icmsVenda', v)}
            sufixo="%"
            dica="Zero quando a substituição tributária já encerrou o ICMS."
          />
          <Campo
            rotulo="PIS e Cofins na venda"
            valor={c.pisCofinsVenda}
            aoMudar={(v) => muda('pisCofinsVenda', v)}
            sufixo="%"
            dica="Valem até 2026; zero no monofásico."
          />
        </>
      )}

      <Campo
        rotulo="Despesas variáveis"
        valor={c.despesas}
        aoMudar={(v) => muda('despesas', v)}
        sufixo="%"
        dica="Comissão, taxa de cartão, frete de venda etc."
      />

      <Opcoes
        rotulo="Margem calculada sobre"
        valor={c.baseMargem}
        opcoes={[
          { valor: 'PRECO_COM_TRIBUTO', texto: 'O que o cliente paga' },
          { valor: 'RECEITA_LIQUIDA', texto: 'A receita líquida' },
        ]}
        aoMudar={(v) => muda('baseMargem', v)}
      />

      <Opcoes<Tratamento>
        rotulo="CBS e IBS do produto (de 2027 em diante)"
        valor={c.tratamento}
        opcoes={(Object.keys(ROTULO_TRATAMENTO) as Tratamento[]).map((t) => ({
          valor: t,
          texto: ROTULO_TRATAMENTO[t],
        }))}
        aoMudar={(v) => muda('tratamento', v)}
      />

      <Opcoes
        rotulo="Cenário de 2029 a 2033"
        valor={c.cenario}
        opcoes={CENARIOS.map((x) => ({ valor: x, texto: DESCRICAO_CENARIOS[x] }))}
        aoMudar={(v) => muda('cenario', v)}
      />

      {faltas.length > 0 && (
        <Text style={estilos.falta}>Falta preencher: {faltas.join(', ')}.</Text>
      )}
      <Pressable
        onPress={() => faltas.length === 0 && aoSalvar(c)}
        style={[estilos.botao, faltas.length > 0 && estilos.botaoInativo]}
        accessibilityRole="button"
        accessibilityState={{ disabled: faltas.length > 0 }}
      >
        <Text style={estilos.botaoTexto}>Salvar e calcular</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  tela: { flex: 1, backgroundColor: CORES.papel },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  simbolo: { width: 32, height: 32 },
  marcaTexto: { fontSize: 18, color: CORES.tinta },
  negrito: { fontWeight: '800' },
  botaoTopo: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CORES.primaria,
  },
  botaoTopoTexto: { color: CORES.primaria, fontWeight: '700' },
  conteudo: { padding: 16, gap: 16, paddingBottom: 48 },
  titulo: { fontSize: 24, fontWeight: '800', color: CORES.tinta },
  linhaCampos: { flexDirection: 'row', gap: 12 },
  campo: { gap: 6 },
  campoGrande: { flex: 1 },
  rotulo: { fontSize: 14, fontWeight: '700', color: CORES.tinta },
  rotuloClaro: { fontSize: 14, color: '#cfe0f5' },
  entradaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 12,
    backgroundColor: CORES.superficie,
    paddingHorizontal: 12,
  },
  entrada: { flex: 1, fontSize: 18, paddingVertical: 12, color: CORES.tinta },
  entradaGrande: { fontSize: 26, fontWeight: '700' },
  sufixo: { fontSize: 16, color: CORES.suave, fontWeight: '700' },
  dica: { fontSize: 12, color: CORES.suave },
  anos: { flexGrow: 0 },
  ano: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  anoAtivo: { backgroundColor: CORES.primaria, borderColor: CORES.primaria },
  anoTexto: { fontWeight: '700', color: CORES.tinta },
  anoTextoAtivo: { color: '#ffffff' },
  aviso: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f2a65a',
    backgroundColor: '#fff7ed',
  },
  avisoTexto: { color: '#9a3412', fontSize: 15 },
  cartaoDestaque: { padding: 20, borderRadius: 18, backgroundColor: CORES.primaria, gap: 8 },
  linhaStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selo: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#ffffff',
  },
  seloTexto: { fontSize: 12, fontWeight: '700' },
  preco: { fontSize: 44, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
  sugestao: { color: '#e0b25e', fontWeight: '700' },
  barra: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: 8,
    backgroundColor: '#ffffff',
  },
  impostosDestaque: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff4e5',
  },
  impostosTitulo: { color: '#9a3412', fontWeight: '800' },
  impostosValor: { color: '#9a3412', fontWeight: '800' },
  linhaParte: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  ponto: { width: 10, height: 10, borderRadius: 3 },
  parteNome: { flex: 1, color: '#e8ecf4', fontSize: 15 },
  parteValor: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  parteImposto: { color: '#ffd8a8', fontWeight: '800' },
  margens: { color: '#cfe0f5', fontSize: 13, marginTop: 4 },
  cartao: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
    gap: 4,
  },
  tituloCartao: { fontSize: 16, fontWeight: '800', color: CORES.tinta, marginBottom: 4 },
  linhaTempo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  linhaTempoAtiva: { backgroundColor: '#eef3f8' },
  linhaAno: { width: 44, fontWeight: '700', color: CORES.tinta },
  linhaImpostos: { flex: 1, color: CORES.suave, fontSize: 13 },
  linhaValor: { fontWeight: '800', color: CORES.tinta },
  nota: { fontSize: 12, color: CORES.suave, marginTop: 6 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  opcaoAtiva: { borderColor: CORES.primaria, backgroundColor: '#eef3f8' },
  opcaoTexto: { color: CORES.tinta },
  opcaoTextoAtiva: { color: CORES.primaria, fontWeight: '800' },
  falta: { color: CORES.erro, fontWeight: '700' },
  botao: {
    backgroundColor: CORES.primaria,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botaoInativo: { opacity: 0.5 },
  botaoTexto: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});
