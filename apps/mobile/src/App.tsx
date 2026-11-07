import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  type HostInstance,
  type ScrollViewInstance,
  Image,
  StatusBar as BarraDeStatus,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { CENARIOS, DESCRICAO_CENARIOS } from '@calculafiscal/regras/cenarios';
import {
  calcular,
  CONFIG_INICIAL,
  numero,
  pendenciasConfig,
  ROTULO_REGIME,
  ROTULO_TRATAMENTO,
  type ConfigEmpresa,
  type RegimeApp,
  type ResultadoAnoApp,
  type Seletivo,
  type Tratamento,
} from './calculo';
import {
  dataCurta,
  DIAS_PARA_AVISO,
  diasSemConferir,
  estadoInicial,
  procurarAtualizacao,
  type EstadoTabelas,
  type Guardado,
} from './tabelas';
import { dasEfetivoComercio, REFERENCIAS } from './referencias';
import { CORES, COR_IMPOSTO, COR_STATUS, porcento, reais, ROTULO_STATUS } from './formato';

const CHAVE_CONFIG = 'calculadora-fiscal:config:v1';
const CHAVE_ULTIMO = 'calculadora-fiscal:ultimo:v1';
const CHAVE_PACOTE = 'calculadora-fiscal:regras-pacote:v1';
const CHAVE_VERIFICADO = 'calculadora-fiscal:regras-verificado:v1';

type Busca = 'parada' | 'buscando' | 'em-dia' | 'atualizada' | 'sem-conexao' | 'recusada';

async function lerTexto(chave: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** O pacote de regras guardado; a assinatura é conferida de novo em estadoInicial. */
async function lerGuardado(): Promise<Guardado> {
  const bruto = await lerTexto(CHAVE_PACOTE);
  let pacote: Guardado['pacote'] = null;
  try {
    pacote = bruto ? (JSON.parse(bruto) as Guardado['pacote']) : null;
  } catch {
    pacote = null;
  }
  return { pacote, verificadoEm: await lerTexto(CHAVE_VERIFICADO) };
}

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
    <>
      <StatusBar style="dark" />
      <Raiz />
    </>
  );
}

function Raiz() {
  const [carregado, setCarregado] = useState(false);
  const [config, setConfig] = useState<ConfigEmpresa>(CONFIG_INICIAL);
  const [tela, setTela] = useState<'calculadora' | 'empresa'>('calculadora');
  /** Muda a cada toque em "Início": a tela de cálculo rola até o começo. */
  const [inicio, setInicio] = useState(0);
  const irParaInicio = () => {
    setTela('calculadora');
    setInicio((n) => n + 1);
  };

  // Botão "voltar" do Android: da tela Empresa volta ao cálculo; no cálculo, fecha o app.
  useEffect(() => {
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tela === 'empresa') {
        setTela('calculadora');
        return true;
      }
      return false;
    });
    return () => assinatura.remove();
  }, [tela]);
  const [custo, setCusto] = useState('');
  const [margem, setMargem] = useState('');
  const [ano, setAno] = useState(2026);
  const [ncm, setNcm] = useState('');
  const [tabelas, setTabelas] = useState<EstadoTabelas>(() => estadoInicial(null));
  const [busca, setBusca] = useState<Busca>('parada');
  const [motivo, setMotivo] = useState('');

  /** Confere no site se há tabela nova. Sem internet, segue com a que está no celular. */
  const procurar = async (atual: EstadoTabelas) => {
    setBusca('buscando');
    const r = await procurarAtualizacao(atual.tabela);
    if (r.tipo === 'atualizada') {
      setTabelas({ tabela: r.tabela, origem: 'baixada', verificadoEm: r.verificadoEm });
      gravarJson(CHAVE_PACOTE, r.pacote);
    } else if (r.tipo === 'em-dia') {
      setTabelas((t) => ({ ...t, verificadoEm: r.verificadoEm }));
    }
    if (r.tipo === 'atualizada' || r.tipo === 'em-dia') {
      AsyncStorage.setItem(CHAVE_VERIFICADO, r.verificadoEm).catch(() => undefined);
    }
    setMotivo(r.tipo === 'recusada' ? r.motivo : '');
    setBusca(r.tipo);
  };

  useEffect(() => {
    void (async () => {
      const c = await lerJson(CHAVE_CONFIG, CONFIG_INICIAL);
      const u = await lerJson(CHAVE_ULTIMO, { custo: '', margem: '', ano: 2026, ncm: '' });
      const estado = estadoInicial(await lerGuardado());
      setConfig(c);
      setCusto(u.custo);
      setMargem(u.margem);
      setAno(u.ano);
      setNcm(u.ncm);
      setTabelas(estado);
      if (pendenciasConfig(c).length > 0) setTela('empresa');
      setCarregado(true);
      void procurar(estado);
    })();
    // procurar só usa setters estáveis; roda uma vez, ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (carregado) gravarJson(CHAVE_ULTIMO, { custo, margem, ano, ncm });
  }, [carregado, custo, margem, ano, ncm]);

  if (!carregado) return <View style={[estilos.tela, estilos.areaSegura]} />;

  return (
    <View style={[estilos.tela, estilos.areaSegura]}>
      <View style={estilos.topo}>
        <Pressable
          onPress={irParaInicio}
          style={estilos.marca}
          accessibilityRole="button"
          accessibilityLabel="Início"
        >
          <Image
            source={require('../assets/icon.png')}
            style={estilos.simbolo}
            accessibilityIgnoresInvertColors
          />
          <Text style={estilos.marcaTexto} numberOfLines={1}>
            Calculadora <Text style={estilos.negrito}>Fiscal</Text>
          </Text>
        </Pressable>
      </View>
      <View style={estilos.abas} accessibilityRole="tablist">
        {(
          [
            { id: 'calculadora', texto: 'Calcular preço' },
            { id: 'empresa', texto: 'Minha empresa' },
          ] as const
        ).map((a) => {
          const ativa = tela === a.id;
          return (
            <Pressable
              key={a.id}
              onPress={() => (a.id === 'calculadora' ? irParaInicio() : setTela('empresa'))}
              style={[estilos.aba, ativa && estilos.abaAtiva]}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
            >
              <Text style={[estilos.abaTexto, ativa && estilos.abaTextoAtiva]}>{a.texto}</Text>
            </Pressable>
          );
        })}
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
            inicio={inicio}
            ncm={ncm}
            setCusto={setCusto}
            setMargem={setMargem}
            setAno={setAno}
            setNcm={setNcm}
            tabelas={tabelas}
            busca={busca}
            motivo={motivo}
            aoProcurar={() => void procurar(tabelas)}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Campo(props: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  sufixo?: string;
  grande?: boolean;
  dica?: string;
  exemplo?: string;
  teclado?: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={[estilos.campo, props.grande && estilos.campoGrande]}>
      <Text style={estilos.rotulo}>{props.rotulo}</Text>
      <View style={estilos.entradaLinha}>
        <TextInput
          value={props.valor}
          onChangeText={props.aoMudar}
          keyboardType={props.teclado ?? 'decimal-pad'}
          placeholder={props.exemplo ?? '0'}
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
  inicio: number;
  ncm: string;
  setCusto: (v: string) => void;
  setMargem: (v: string) => void;
  setAno: (v: number) => void;
  setNcm: (v: string) => void;
  tabelas: EstadoTabelas;
  busca: Busca;
  motivo: string;
  aoProcurar: () => void;
}) {
  const tabela = props.tabelas.tabela;
  const rolagem = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    rolagem.current?.scrollTo({ y: 0, animated: true });
  }, [props.inicio]);
  const calculo = useMemo(
    () => calcular(props.config, props.custo, props.margem, { ncm: props.ncm, tabela }),
    [props.config, props.custo, props.margem, props.ncm, tabela],
  );
  const atual = calculo.ok ? calculo.anos.find((a) => a.ano === props.ano) : undefined;
  const dias = diasSemConferir(props.tabelas);
  const imagem = useRef<HostInstance>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const [erroCompartilhar, setErroCompartilhar] = useState('');

  /** Foto do cartão do resultado, aberta no menu do Android (WhatsApp, e-mail etc.). */
  const compartilhar = async () => {
    setErroCompartilhar('');
    setCompartilhando(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setErroCompartilhar('Este celular não permite compartilhar arquivos.');
        return;
      }
      const uri = await captureRef(imagem, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar preço' });
    } catch {
      setErroCompartilhar('Não foi possível gerar a imagem.');
    } finally {
      setCompartilhando(false);
    }
  };

  return (
    <ScrollView
      ref={rolagem}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
    >
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

      <Campo
        rotulo="NCM do produto (opcional)"
        valor={props.ncm}
        aoMudar={props.setNcm}
        teclado="number-pad"
        exemplo="2202.10.00"
        dica={DICA_SELETIVO[calculo.ok ? calculo.seletivo : 'sem-ncm']}
      />

      {dias > DIAS_PARA_AVISO && (
        <View style={estilos.aviso}>
          <Text style={estilos.avisoTexto}>
            Faz {dias} dias que o app não confere as tabelas de alíquotas no site. Conecte à
            internet e toque em Procurar atualização, no fim da tela.
          </Text>
        </View>
      )}

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
        <>
          <View ref={imagem} collapsable={false} style={estilos.areaImagem}>
            <Resultado
              r={atual}
              resumo={[
                `Custo ${reais(numero(props.custo) ?? '0')}`,
                `margem ${props.margem}%`,
                ROTULO_REGIME[props.config.regime],
                ...(props.ncm.trim() ? [`NCM ${props.ncm.trim()}`] : []),
              ].join(' · ')}
            />
          </View>
          <Pressable
            onPress={() => void compartilhar()}
            disabled={compartilhando}
            style={[estilos.botaoCompartilhar, compartilhando && estilos.botaoInativo]}
            accessibilityRole="button"
          >
            <Text style={estilos.botaoTexto}>
              {compartilhando ? 'Gerando imagem…' : 'Compartilhar no WhatsApp'}
            </Text>
          </Pressable>
          {erroCompartilhar !== '' && <Text style={estilos.falta}>{erroCompartilhar}</Text>}
        </>
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

      <CartaoTabelas
        estado={props.tabelas}
        busca={props.busca}
        motivo={props.motivo}
        aoProcurar={props.aoProcurar}
      />
    </ScrollView>
  );
}

const DICA_SELETIVO: Readonly<Record<Seletivo, string>> = {
  'sem-ncm':
    'Informe para bebidas açucaradas, bebidas alcoólicas e fumo, que pagam Imposto Seletivo a partir de fevereiro de 2027.',
  'nao-incide': 'Este NCM não tem Imposto Seletivo nas tabelas.',
  incide:
    'Tem Imposto Seletivo a partir de fevereiro de 2027. Ele é cobrado do fabricante ou importador e chega embutido no seu custo de compra, sem crédito.',
};

const TEXTO_BUSCA: Readonly<Record<Busca, string>> = {
  parada: '',
  buscando: 'Conferindo no site…',
  'em-dia': 'As tabelas estão em dia.',
  atualizada: 'Tabelas atualizadas. A assinatura digital foi conferida.',
  'sem-conexao': 'Sem conexão com o site: seguem as tabelas que estão no celular.',
  recusada: 'O pacote do site foi recusado e seguem as tabelas que estão no celular.',
};

/** Versão e data das tabelas em uso, e o botão para procurar uma versão nova no site. */
function CartaoTabelas(props: {
  estado: EstadoTabelas;
  busca: Busca;
  motivo: string;
  aoProcurar: () => void;
}) {
  const { tabela, origem, verificadoEm } = props.estado;
  const dias = diasSemConferir(props.estado);
  return (
    <View style={[estilos.cartao, dias > DIAS_PARA_AVISO && estilos.cartaoAlerta]}>
      <Text style={estilos.tituloCartao}>Tabelas de alíquotas</Text>
      <Text style={estilos.dica}>
        Versão {tabela.versao}, publicada em {dataCurta(tabela.publicadoEm)}
        {origem === 'baixada' ? ' e baixada do site.' : ', que veio com o app.'}
      </Text>
      <Text style={estilos.dica}>
        {verificadoEm
          ? `Conferidas no site em ${dataCurta(verificadoEm)}.`
          : 'Ainda não conferidas no site.'}
      </Text>
      {props.busca !== 'parada' && (
        <Text style={props.busca === 'recusada' ? estilos.falta : estilos.dica}>
          {TEXTO_BUSCA[props.busca]}
          {props.motivo ? ` (${props.motivo})` : ''}
        </Text>
      )}
      <Pressable
        onPress={props.aoProcurar}
        disabled={props.busca === 'buscando'}
        style={[estilos.atalho, props.busca === 'buscando' && estilos.botaoInativo]}
        accessibilityRole="button"
      >
        <Text style={estilos.atalhoTexto}>Procurar atualização</Text>
      </Pressable>
    </View>
  );
}

const ROTULO_PARTE: Readonly<Record<string, string>> = { IS: 'Imposto Seletivo (na compra)' };

function Resultado({ r, resumo }: { r: ResultadoAnoApp; resumo: string }) {
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
            <Text style={[estilos.parteNome, imposto && estilos.parteImposto]}>
              {ROTULO_PARTE[p.nome] ?? p.nome}
            </Text>
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
      <Text style={estilos.resumo}>{resumo}</Text>
      <Text style={estilos.assinaturaImagem}>
        Calculadora Fiscal · imposto.trustcorp.com.br · simulação, confirme com o seu contador
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

/** Soma dois percentuais digitados ("6" + "2,28" = "8,28"). Vazio conta como zero. */
function somar(a: string, b: string): string {
  const x = Number(numero(a) ?? '0');
  const y = Number(numero(b) ?? '0');
  return String(Math.round((x + y) * 100) / 100).replace('.', ',');
}

/** Botões que preenchem um campo com um valor de referência, com uma nota explicando. */
function Atalhos(props: {
  titulo: string;
  opcoes: readonly { texto: string; valor: string }[];
  aoUsar: (valor: string) => void;
  nota: string;
}) {
  return (
    <View style={estilos.ajuda}>
      <Text style={estilos.ajudaTitulo}>{props.titulo}</Text>
      <View style={estilos.opcoes}>
        {props.opcoes.map((o) => (
          <Pressable
            key={o.texto}
            onPress={() => props.aoUsar(o.valor)}
            style={estilos.atalho}
            accessibilityRole="button"
          >
            <Text style={estilos.atalhoTexto}>{o.texto}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={estilos.dica}>{props.nota}</Text>
    </View>
  );
}

/** Não sabe o DAS? Calcula a alíquota efetiva do comércio pelo faturamento de 12 meses. */
function AjudaSimples({ aoUsar }: { aoUsar: (percentual: string) => void }) {
  const [faturamento, setFaturamento] = useState('');
  const r = faturamento.trim() === '' ? null : dasEfetivoComercio(faturamento);
  return (
    <View style={estilos.ajuda}>
      <Text style={estilos.ajudaTitulo}>Não sabe o DAS?</Text>
      <Text style={estilos.dica}>
        Informe quanto a empresa faturou nos últimos 12 meses. A conta usa a tabela do comércio
        (Anexo I da LC 123): por exemplo, R$ 360 mil por ano dá cerca de 5,65%, e R$ 720 mil, cerca
        de 7,58%.
      </Text>
      <Campo
        rotulo="Faturamento dos últimos 12 meses"
        valor={faturamento}
        aoMudar={setFaturamento}
        sufixo="R$"
      />
      {r && !r.ok && <Text style={estilos.falta}>{r.erro}</Text>}
      {r && r.ok && (
        <>
          <Text style={estilos.ajudaResultado}>
            DAS efetivo estimado: {r.percentual}% (faixa {r.faixa} do comércio)
          </Text>
          {r.aviso && <Text style={estilos.falta}>{r.aviso}</Text>}
          <Pressable
            onPress={() => aoUsar(r.percentual)}
            style={estilos.atalho}
            accessibilityRole="button"
          >
            <Text style={estilos.atalhoTexto}>Usar {r.percentual}%</Text>
          </Pressable>
        </>
      )}
      <Text style={estilos.dica}>
        Indústria e serviços usam outras tabelas (Anexos II a V). Produtos com ICMS-ST ou
        monofásicos pagam menos DAS, porque essas parcelas saem da conta.
      </Text>
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
        <>
          <Campo
            rotulo="Alíquota efetiva do DAS"
            valor={c.aliquotaDas}
            aoMudar={(v) => muda('aliquotaDas', v)}
            sufixo="%"
            dica="O percentual que você paga de DAS sobre o faturamento do mês."
          />
          <AjudaSimples aoUsar={(v) => muda('aliquotaDas', v)} />
        </>
      ) : (
        <>
          <Campo
            rotulo="ICMS na venda"
            valor={c.icmsVenda}
            aoMudar={(v) => muda('icmsVenda', v)}
            sufixo="%"
          />
          <Atalhos
            titulo="Exemplos de ICMS"
            opcoes={[
              { texto: `${REFERENCIAS.icmsSp}% (alíquota geral de SP)`, valor: REFERENCIAS.icmsSp },
              { texto: '0% (comprei com ICMS-ST)', valor: REFERENCIAS.icmsComSt },
            ]}
            aoUsar={(v) => muda('icmsVenda', v)}
            nota="A alíquota geral muda de estado para estado (em geral de 17% a 22%). Se a mercadoria veio com substituição tributária, o ICMS da venda já foi pago: use 0%."
          />
          <Campo
            rotulo="PIS e Cofins na venda"
            valor={c.pisCofinsVenda}
            aoMudar={(v) => muda('pisCofinsVenda', v)}
            sufixo="%"
          />
          <Atalhos
            titulo="Exemplo de PIS e Cofins"
            opcoes={
              c.regime === 'PRESUMIDO'
                ? [
                    {
                      texto: `${REFERENCIAS.pisCofinsPresumido}% (cumulativo: 0,65% + 3%)`,
                      valor: REFERENCIAS.pisCofinsPresumido,
                    },
                    { texto: '0% (produto monofásico)', valor: '0' },
                  ]
                : [
                    {
                      texto: `${REFERENCIAS.pisCofinsReal}% (não cumulativo: 1,65% + 7,6%)`,
                      valor: REFERENCIAS.pisCofinsReal,
                    },
                    { texto: '0% (produto monofásico)', valor: '0' },
                  ]
            }
            aoUsar={(v) => muda('pisCofinsVenda', v)}
            nota="Valem até 2026. De 2027 em diante PIS e Cofins dão lugar à CBS, e o app já calcula assim."
          />
        </>
      )}

      <Campo
        rotulo="Despesas variáveis"
        valor={c.despesas}
        aoMudar={(v) => muda('despesas', v)}
        sufixo="%"
        dica="Tudo o que sai em percentual de cada venda: taxa de cartão (em geral 2% a 5%), comissão, frete de entrega."
      />
      {c.regime === 'PRESUMIDO' && (
        <Atalhos
          titulo="IRPJ e CSLL no Lucro Presumido"
          opcoes={[
            {
              texto: `Somar ${REFERENCIAS.irpjCsllPresumidoComercio}% às despesas`,
              valor: somar(c.despesas, REFERENCIAS.irpjCsllPresumidoComercio),
            },
          ]}
          aoUsar={(v) => muda('despesas', v)}
          nota="No Presumido, IRPJ e CSLL são cobrados sobre a receita: no comércio, cerca de 2,28% (IRPJ 15% × 8% + CSLL 9% × 12%), mais se houver o adicional do IRPJ. Inclua nas despesas."
        />
      )}
      {c.regime === 'REAL' && (
        <Text style={estilos.dica}>
          No Lucro Real, IRPJ e CSLL incidem sobre o lucro, não sobre cada venda: não entram nas
          despesas.
        </Text>
      )}

      <View style={estilos.avisoContador}>
        <Text style={estilos.avisoContadorTitulo}>Valores de referência</Text>
        <Text style={estilos.avisoContadorTexto}>
          Os exemplos são taxas e percentuais médios, só para começar. O percentual certo da sua
          empresa depende do faturamento, do produto e do estado: confirme com o seu contador.
        </Text>
      </View>

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
  // O Android desenha o app sob a barra de status (edge-to-edge): afasta o conteúdo dela.
  areaSegura: { paddingTop: Platform.OS === 'android' ? (BarraDeStatus.currentHeight ?? 24) : 44 },
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
  marca: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, marginRight: 12 },
  simbolo: { width: 32, height: 32 },
  marcaTexto: { fontSize: 17, color: CORES.tinta, flexShrink: 1 },
  negrito: { fontWeight: '800' },
  abas: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CORES.superficie,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CORES.primaria,
  },
  abaAtiva: { backgroundColor: CORES.primaria },
  abaTexto: { color: CORES.primaria, fontWeight: '800', fontSize: 15 },
  abaTextoAtiva: { color: '#ffffff' },
  // Folga embaixo para a barra de navegação do Android, que fica por cima do conteúdo.
  conteudo: { padding: 16, gap: 16, paddingBottom: 72 },
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
  ajuda: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#eef3f8',
    borderWidth: 1,
    borderColor: '#cddbe9',
  },
  ajudaTitulo: { fontSize: 15, fontWeight: '800', color: CORES.primaria },
  ajudaResultado: { fontSize: 16, fontWeight: '800', color: CORES.tinta },
  atalho: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CORES.primaria,
  },
  atalhoTexto: { color: '#ffffff', fontWeight: '700' },
  avisoContador: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f2a65a',
    gap: 4,
  },
  avisoContadorTitulo: { color: '#9a3412', fontWeight: '800' },
  avisoContadorTexto: { color: '#9a3412' },
  botao: {
    backgroundColor: CORES.primaria,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botaoInativo: { opacity: 0.5 },
  areaImagem: { backgroundColor: CORES.papel },
  botaoCompartilhar: {
    backgroundColor: '#1e7a4c',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cartaoAlerta: { borderColor: '#f2a65a', backgroundColor: '#fff7ed' },
  resumo: { color: '#e8ecf4', fontSize: 13, marginTop: 6 },
  assinaturaImagem: { color: '#9fb6d3', fontSize: 11, marginTop: 2 },
  botaoTexto: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});
