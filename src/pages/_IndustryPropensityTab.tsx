// @ts-nocheck
import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

// ── Static industry metadata (icon/color/urgency — não muda com o catálogo) ──
const IND_META: Record<string, any> = {
  "55": { name:"Mill Products & Mining",          icon:"⛏️", color:"#78350f", urgency:"high",   urgencyLabel:"Alta pressão regulatória",    h26:"Digitalização de operações e compliance ESG",    h27:"Autonomia operacional via AI e manutenção preditiva" },
  "13": { name:"Retail",                           icon:"🏪", color:"#b91c1c", urgency:"high",   urgencyLabel:"Transformação urgente",         h26:"Unificação omnichannel e gestão de margem por SKU", h27:"Hiperpersonalização via AI e automação de loja" },
  "63": { name:"Agribusiness",                     icon:"🌱", color:"#166534", urgency:"growing",urgencyLabel:"Boom de investimento",           h26:"Rastreabilidade ESG, EUDR e gestão de safra em cloud", h27:"Agricultura de precisão com AI + IoT" },
  "03": { name:"Banking",                          icon:"🏦", color:"#1e40af", urgency:"high",   urgencyLabel:"Pressão regulatória + fintech", h26:"Open Finance compliance e AI para risco",         h27:"Banking as a Platform e GenAI no atendimento" },
  "3":  { name:"Banking",                          icon:"🏦", color:"#1e40af", urgency:"high",   urgencyLabel:"Pressão regulatória + fintech", h26:"Open Finance compliance e AI para risco",         h27:"Banking as a Platform e GenAI no atendimento" },
  "05": { name:"Consumer Products",                icon:"🛒", color:"#7c3aed", urgency:"high",   urgencyLabel:"Alta competição D2C",            h26:"Trade promotion, D2C e integração omnichannel",   h27:"Demand sensing com AI e personalização de portfólio" },
  "5":  { name:"Consumer Products",                icon:"🛒", color:"#7c3aed", urgency:"high",   urgencyLabel:"Alta competição D2C",            h26:"Trade promotion, D2C e integração omnichannel",   h27:"Demand sensing com AI e personalização de portfólio" },
  "15": { name:"Utilities",                        icon:"⚡", color:"#a16207", urgency:"growing",urgencyLabel:"Transição energética",           h26:"Smart grid, gestão de ativos e compliance",        h27:"Descarbonização e gestão de energia renovável" },
  "02": { name:"Automotive",                       icon:"🚗", color:"#374151", urgency:"high",   urgencyLabel:"Disrupção elétrica EV",          h26:"Supply chain resiliente para EV e BOM complexo",  h27:"Manufacturing 4.0 e AI para qualidade/emissões" },
  "2":  { name:"Automotive",                       icon:"🚗", color:"#374151", urgency:"high",   urgencyLabel:"Disrupção elétrica EV",          h26:"Supply chain resiliente para EV e BOM complexo",  h27:"Manufacturing 4.0 e AI para qualidade/emissões" },
  "11": { name:"Life Sciences",                    icon:"🧬", color:"#0f766e", urgency:"high",   urgencyLabel:"Compliance + inovação",          h26:"GxP compliance em cloud e serialização",           h27:"AI para P&D e supply chain resiliente" },
  "35": { name:"Wholesale Distribution",           icon:"📦", color:"#0369a1", urgency:"medium", urgencyLabel:"Pressão de eficiência",          h26:"Modernização de WMS e visibilidade de margem",    h27:"AI para demand forecasting e automação de warehouse" },
  "66": { name:"Travel & Transportation",          icon:"✈️", color:"#0f766e", urgency:"growing",urgencyLabel:"Recuperação + digitalização",   h26:"Gestão de frota e experiência do passageiro",     h27:"AI para dynamic pricing e manutenção preditiva" },
  "10": { name:"Oil, Gas & Energy",                icon:"🛢️", color:"#92400e", urgency:"medium", urgencyLabel:"Modernização + ESG",             h26:"Integração campo-escritório e manutenção",         h27:"AI para otimização de reservatórios" },
  "37": { name:"Engineering & Construction",       icon:"🏗️", color:"#b45309", urgency:"growing",urgencyLabel:"Boom de infraestrutura LAC",    h26:"Controle de custo e cronograma em cloud",          h27:"BIM integrado ao ERP e AI para risk management" },
  "04": { name:"Chemicals",                        icon:"⚗️", color:"#6d28d9", urgency:"medium", urgencyLabel:"ESG + processo contínuo",        h26:"Compliance REACH/CLP e processo contínuo em cloud", h27:"Química verde e AI para formulação" },
  "4":  { name:"Chemicals",                        icon:"⚗️", color:"#6d28d9", urgency:"medium", urgencyLabel:"ESG + processo contínuo",        h26:"Compliance REACH/CLP e processo contínuo em cloud", h27:"Química verde e AI para formulação" },
  "31": { name:"Professional Services",            icon:"💼", color:"#1e3a5f", urgency:"growing",urgencyLabel:"Crescimento acelerado",          h26:"Gestão de projetos e recursos em cloud",           h27:"AI para precificação, staffing e entrega de projetos" },
  // ── Novos segmentos ──────────────────────────────────────────────────────────
  "07": { name:"Healthcare",                       icon:"🏥", color:"#065f46", urgency:"growing",urgencyLabel:"Digitalização acelerada",        h26:"Gestão hospitalar em cloud e compliance regulatório", h27:"AI diagnóstica, telemedicina e supply chain farmacêutico" },
  "7":  { name:"Healthcare",                       icon:"🏥", color:"#065f46", urgency:"growing",urgencyLabel:"Digitalização acelerada",        h26:"Gestão hospitalar em cloud e compliance regulatório", h27:"AI diagnóstica, telemedicina e supply chain farmacêutico" },
  "12": { name:"Public Sector",                    icon:"🏛️", color:"#1e3a5f", urgency:"medium", urgencyLabel:"Modernização digital",           h26:"ERP público em cloud e gestão de força de trabalho", h27:"Governo digital, automação de processos e AI para serviços públicos" },
  "14": { name:"Telecommunications",               icon:"📡", color:"#4338ca", urgency:"high",   urgencyLabel:"Transformação de rede + BSS/OSS", h26:"ERP cloud e modernização de BSS/OSS",              h27:"5G monetization, AI para churn prediction e rede autônoma" },
  "06": { name:"Industrial Manufacturing",         icon:"🏭", color:"#374151", urgency:"medium", urgencyLabel:"Indústria 4.0",                  h26:"ERP cloud para manufatura discreta e gestão de BOM", h27:"Digital twin, AI para qualidade e supply chain resiliente" },
  "6":  { name:"Industrial Manufacturing",         icon:"🏭", color:"#374151", urgency:"medium", urgencyLabel:"Indústria 4.0",                  h26:"ERP cloud para manufatura discreta e gestão de BOM", h27:"Digital twin, AI para qualidade e supply chain resiliente" },
  "30": { name:"Higher Education & Research",      icon:"🎓", color:"#1e40af", urgency:"medium", urgencyLabel:"Pressão por eficiência",          h26:"ERP acadêmico em cloud e gestão de capital humano",  h27:"AI para research analytics e personalização de ensino" },
  "09": { name:"Insurance",                        icon:"🛡️", color:"#1e3a5f", urgency:"high",   urgencyLabel:"Transformação digital + InsurTech", h26:"Finance transformation e AI para subscrição/risco", h27:"Hiperpersonalização de apólices via AI e plataforma aberta" },
  "9":  { name:"Insurance",                        icon:"🛡️", color:"#1e3a5f", urgency:"high",   urgencyLabel:"Transformação digital + InsurTech", h26:"Finance transformation e AI para subscrição/risco", h27:"Hiperpersonalização de apólices via AI e plataforma aberta" },
  "08": { name:"High Tech",                        icon:"💻", color:"#0070f2", urgency:"growing",urgencyLabel:"Inovação contínua",               h26:"ERP cloud nativo e gestão de subscription revenue", h27:"AI-native operations, PLM digital e software monetization" },
  "8":  { name:"High Tech",                        icon:"💻", color:"#0070f2", urgency:"growing",urgencyLabel:"Inovação contínua",               h26:"ERP cloud nativo e gestão de subscription revenue", h27:"AI-native operations, PLM digital e software monetization" },
  "27": { name:"Media & Entertainment",            icon:"🎬", color:"#7c3aed", urgency:"medium", urgencyLabel:"Transformação de modelo",         h26:"Gestão de direitos digitais e receita streaming",   h27:"AI para personalização de conteúdo e monetização de audiência" },
  "25": { name:"Sports & Entertainment",           icon:"🏆", color:"#dc2626", urgency:"medium", urgencyLabel:"Experiência do fã",               h26:"Gestão de venue, ticketing e experiência do fã",    h27:"AI para engajamento personalizado e otimização de receita" },
  "36": { name:"Defense & Security",               icon:"🛡", color:"#374151", urgency:"medium", urgencyLabel:"Compliance + cadeia de suprimentos", h26:"ERP para defesa, MRO e compliance regulatório",    h27:"Supply chain resiliente e gestão de ativos de missão crítica" },
  "01": { name:"Aerospace & Defense",              icon:"🚀", color:"#1e3a5f", urgency:"medium", urgencyLabel:"MRO + compliance",                h26:"MRO digital, BOM complexo e gestão de projetos",    h27:"Manutenção preditiva de frota e compliance de aeronavegabilidade" },
  "1":  { name:"Aerospace & Defense",              icon:"🚀", color:"#1e3a5f", urgency:"medium", urgencyLabel:"MRO + compliance",                h26:"MRO digital, BOM complexo e gestão de projetos",    h27:"Manutenção preditiva de frota e compliance de aeronavegabilidade" },
  "38": { name:"Postal Services",                  icon:"📮", color:"#0369a1", urgency:"medium", urgencyLabel:"Last-mile + digitalização",       h26:"ERP cloud para logística e gestão de rede postal",  h27:"AI para otimização de rotas e automação de sorting centers" },
}

const COMPETITORS: Record<string, string[]> = {
  "55": ["Oracle (Vale, Votorantim)","Microsoft (Azure IoT / Anglo American)","AWS (Barrick Gold)"],
  "13": ["Salesforce (Mag Luiza, Rappi)","Oracle Retail (Renner, Riachuelo)","Manhattan (Americanas, Ponto)","Google Cloud (iFood, ML)"],
  "63": ["Oracle (Cargill, Bunge)","TOTVS Agro (60%+ mid-market BR)","Microsoft (Azure FarmBeats)"],
  "03": ["Salesforce FSC (Bradesco, BTG)","ServiceNow (Itaú ITSM)","Microsoft Azure (Nubank, Banco Inter)","Google CCAI (Citi, XP)"],
  "3":  ["Salesforce FSC (Bradesco, BTG)","ServiceNow (Itaú ITSM)","Microsoft Azure (Nubank, Banco Inter)"],
  "05": ["Salesforce (Ambev)","Oracle (JBS, Marfrig)","Microsoft (Mondelez)","Google Cloud (Heineken)","Manhattan (D2C)"],
  "5":  ["Salesforce (Ambev)","Oracle (JBS, Marfrig)","Microsoft (Mondelez)","Google Cloud (Heineken)"],
  "15": ["Oracle Utilities (ENEL, Celpe)","Microsoft Azure Digital Twins (Energisa)","AWS (Engie Brasil)"],
  "02": ["Oracle (Stellantis, VW BR)","Microsoft Azure Digital Twins (BMW, GM)","Siemens Opcenter (autopeças)"],
  "2":  ["Oracle (Stellantis, VW BR)","Microsoft Azure Digital Twins (BMW, GM)","Siemens Opcenter (autopeças)"],
  "11": ["Oracle LSCS (Roche, Novartis)","Salesforce (Eurofarma, Hypera)","Veeva (Big Pharma LAC)"],
  "35": ["Manhattan WMS (Ambev, GPA)","TOTVS Logística (mid-market BR)","Oracle WMS Cloud"],
  "66": ["Salesforce (LATAM Airlines)","Microsoft Azure (Azul)","AWS (DHL Express LAC)"],
  "10": ["Oracle (Repsol, Total LAC)","Microsoft (Petrobras — Azure)","AWS (SLB)"],
  "37": ["Oracle Primavera (EPCs)","TOTVS Construção (mid-market BR)","Microsoft Project"],
  "04": ["Oracle (Braskem)","AspenTech (process optimization)","TOTVS (mid-market)"],
  "4":  ["Oracle (Braskem)","AspenTech (process optimization)","TOTVS (mid-market)"],
  "31": ["Workday","Salesforce PSA","Oracle NetSuite","ServiceNow"],
  "07": ["Oracle Health (ex-Cerner)","Microsoft (Azure Health)","Salesforce Health Cloud","Epic (grandes hospitais)"],
  "7":  ["Oracle Health (ex-Cerner)","Microsoft (Azure Health)","Salesforce Health Cloud","Epic (grandes hospitais)"],
  "12": ["Oracle (governos LAC)","Microsoft Dynamics 365 (prefeituras)","TOTVS Educação/Governo","Salesforce Government Cloud"],
  "14": ["Amdocs (BSS/OSS)","Oracle Comms (telecos)","Microsoft Azure (infraestrutura)","Salesforce (CX telecom)"],
  "06": ["Oracle Manufacturing (indústria discreta)","Microsoft Dynamics 365 SC","Siemens Opcenter MES","TOTVS Indústria"],
  "6":  ["Oracle Manufacturing","Microsoft Dynamics 365 SC","Siemens Opcenter MES","TOTVS Indústria"],
  "30": ["Oracle Student Cloud","Workday (HCM academia)","Microsoft (Azure Education)","Totvs Educação"],
  "09": ["Guidewire (seguradoras)","Salesforce FSC","Oracle Insurance","Microsoft Azure (analytics)"],
  "9":  ["Guidewire (seguradoras)","Salesforce FSC","Oracle Insurance","Microsoft Azure (analytics)"],
  "08": ["Oracle NetSuite (mid-market tech)","Workday (HCM)","Salesforce (CRM)","Microsoft Dynamics 365"],
  "8":  ["Oracle NetSuite (mid-market tech)","Workday (HCM)","Salesforce (CRM)","Microsoft Dynamics 365"],
  "27": ["Oracle Media & Entertainment","Salesforce Media Cloud","Microsoft Azure Media","AWS Media"],
  "25": ["Salesforce (CX fans)","Oracle (gestão de venue)","Microsoft Azure","AWS (analytics de audiência)"],
  "36": ["Oracle (defesa/governo)","SAP já é líder em algumas forças armadas LAC","Microsoft Azure Government"],
  "01": ["Oracle Aerospace","Siemens (MRO/PLM)","IFS (alternativa para MRO)","Microsoft Azure"],
  "1":  ["Oracle Aerospace","Siemens (MRO/PLM)","IFS (MRO)","Microsoft Azure"],
  "38": ["Oracle","Microsoft Dynamics","TOTVS","Infor"],
}

const TURNOVER: Record<string, string> = {
  "55":"18–24%","13":"35–50%","63":"15–22%","03":"12–18%","3":"12–18%",
  "05":"20–26%","5":"20–26%","15":"10–15%","02":"15–22%","2":"15–22%",
  "11":"14–20%","35":"25–35%","66":"20–30%","10":"10–16%",
  "37":"20–30%","04":"12–18%","4":"12–18%","31":"22–30%",
  "07":"18–25%","7":"18–25%","12":"8–12%","14":"15–20%",
  "06":"12–18%","6":"12–18%","30":"10–15%","09":"10–14%","9":"10–14%",
  "08":"20–28%","8":"20–28%","27":"18–24%","25":"25–35%",
  "36":"6–10%","01":"8–12%","1":"8–12%","38":"15–20%",
}

const HIRING: Record<string, string> = {
  "55":"Engenheiros de dados, automação e operação remota",
  "13":"Omnichannel, data analysts, UX, engenheiros de automação",
  "63":"Agrônomos digitais, especialistas em georreferenciamento",
  "03":"Cientistas de dados, ML, cybersecurity, open finance",
  "3":"Cientistas de dados, ML, cybersecurity, open finance",
  "05":"Especialistas D2C/e-commerce, data scientists para TPM",
  "5":"Especialistas D2C/e-commerce, data scientists para TPM",
  "15":"Engenheiros de energia renovável, smart grid, ESG",
  "02":"Engenheiros de bateria, software embarcado, supply chain EV",
  "2":"Engenheiros de bateria, software embarcado, supply chain EV",
  "11":"Data scientists para P&D, regulatory affairs, QA digital",
  "35":"Especialistas em logística 4.0, operadores de automação",
  "66":"Especialistas MRO digital, analistas de operações aéreas",
  "10":"Engenheiros de dados de subsolo, especialistas ESG",
  "37":"Gerentes de projeto PMP, especialistas BIM, engenheiros de custos",
  "04":"Engenheiros de processo, especialistas EHS e química sustentável",
  "4":"Engenheiros de processo, especialistas EHS e química sustentável",
  "31":"Consultores de AI/data, especialistas cloud, gerentes de projeto",
  "07":"Especialistas em informática médica, analistas de dados clínicos, gestores de telemedicina",
  "7":"Especialistas em informática médica, analistas de dados clínicos, gestores de telemedicina",
  "12":"Especialistas em governo digital, analistas de dados públicos, gerentes de TI governamental",
  "14":"Engenheiros de redes 5G, especialistas BSS/OSS, analistas de churn/AI",
  "06":"Engenheiros de manufatura 4.0, especialistas em automação industrial, data scientists de chão de fábrica",
  "6":"Engenheiros de manufatura 4.0, especialistas em automação industrial",
  "30":"Especialistas em tecnologia educacional, analistas de dados acadêmicos, gestores de ERP universitário",
  "09":"Atuários digitais, especialistas em InsurTech, analistas de risco com AI",
  "9":"Atuários digitais, especialistas em InsurTech, analistas de risco com AI",
  "08":"Engenheiros de produto SaaS, especialistas em subscription management, data scientists",
  "8":"Engenheiros de produto SaaS, especialistas em subscription management",
  "27":"Especialistas em direitos digitais, analistas de audiência, engenheiros de streaming",
  "25":"Especialistas em experiência do fã, analistas de dados de venue, gestores de ticketing digital",
  "36":"Especialistas em compliance de defesa, supply chain crítico, segurança de TI",
  "01":"Engenheiros MRO digital, especialistas em aeronavegabilidade e gestão de configuração",
  "1":"Engenheiros MRO digital, especialistas em aeronavegabilidade",
  "38":"Especialistas em logística last-mile, otimização de rotas e automação postal",
}

const BAR_COLORS: Record<string, string> = {
  "BAIP - Data & AI":                   "#6d28d9",
  "BAIP - Technology Foundation":       "#0b5394",
  "Business Transformation Management": "#351c75",
  "Cloud ERP Private":                  "#0070f2",
  "Customer Experience":                "#7b3aed",
  "Finance and Spend Management":       "#0f766e",
  "Human Capital Management":           "#065f46",
  "Supply Chain Management":            "#92400e",
  "Other":                              "#6b7280",
}

// ── PropCard ──────────────────────────────────────────────────────────────────
function PropCard({ code, catalogByL1 }: { code: string; catalogByL1: Record<string, any[]> }) {
  const [tab, setTab] = useState<'inv'|'comp'|'people'>('inv')
  const meta = IND_META[code]
  if (!meta) return null

  const uc = meta.urgency==='high' ? 'bg-red-50 text-red-700'
           : meta.urgency==='growing' ? 'bg-green-50 text-green-700'
           : 'bg-orange-50 text-orange-700'

  // L1s relevant for this industry from catalog
  const relevantL1s = Object.keys(catalogByL1).filter(l1 => {
    const entries = catalogByL1[l1] || []
    return entries.some(e => {
      const codes = (e.industry_codes || "").split(",").map((c:string) => c.trim().replace(/^0+/,""))
      return codes.includes(code)
    })
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 p-4 pb-3 border-b border-gray-100">
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-600 text-gray-900 text-sm">{meta.name}</div>
          <div className="text-xs text-gray-400">Mastercode {code}</div>
        </div>
        <span className={`text-[10px] font-600 rounded px-2 py-0.5 whitespace-nowrap ${uc}`}>{meta.urgencyLabel}</span>
      </div>

      {/* mini tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {([['inv','📊 Investimentos'],['comp','⚔️ Competição'],['people','👥 People']] as const).map(([k,ic]) => (
          <button key={k} onClick={()=>setTab(k)}
            className={`flex-1 py-1.5 text-[10px] font-500 transition-colors ${tab===k?'bg-white text-blue-700 border-b-2 border-blue-600':'text-gray-400 hover:text-gray-600'}`}>
            {ic}
          </button>
        ))}
      </div>

      <div className="p-3 flex-1 overflow-y-auto" style={{maxHeight:'420px'}}>
        {tab === 'inv' && (
          <>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-blue-50 rounded-lg p-2">
                <div className="text-[9px] font-700 text-blue-400 uppercase mb-1">2026</div>
                <div className="text-[11px] font-500 text-blue-900">{meta.h26}</div>
              </div>
              <div className="flex-1 bg-purple-50 rounded-lg p-2">
                <div className="text-[9px] font-700 text-purple-400 uppercase mb-1">2027</div>
                <div className="text-[11px] font-500 text-purple-900">{meta.h27}</div>
              </div>
            </div>

            {/* Solutions from catalog grouped by L1, ordered by priority */}
            {relevantL1s.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">Sem soluções mapeadas no catálogo</div>
            ) : (() => {
              // Sort L1s by minimum priority of their entries for this industry
              const l1WithPrio = relevantL1s.map(l1 => {
                const entries = (catalogByL1[l1] || []).filter((e:any) => {
                  const codes = (e.industry_codes || "").split(",").map((c:string) => c.trim().replace(/^0+/,""))
                  return codes.includes(code)
                })
                const minPrio = entries.length ? Math.min(...entries.map((e:any) => e.priority || 2)) : 3
                return { l1, entries, minPrio }
              }).filter(x => x.entries.length > 0)
              l1WithPrio.sort((a, b) => a.minPrio - b.minPrio)

              return l1WithPrio.map(({ l1, entries, minPrio }) => {
                const color = BAR_COLORS[l1] || "#6b7280"
                // Group L2s with their L3s, sorted by priority
                const l2Map: Record<string, {l3s: string[], prio: number}> = {}
                entries.forEach((e:any) => {
                  const l2 = e.solution_l2 || ""
                  const l3 = e.solution_l3 || ""
                  const p  = e.priority || 2
                  if (!l2Map[l2]) l2Map[l2] = { l3s: [], prio: p }
                  if (l3 && !l2Map[l2].l3s.includes(l3)) l2Map[l2].l3s.push(l3)
                  if (p < l2Map[l2].prio) l2Map[l2].prio = p
                })
                const l2s = Object.entries(l2Map).sort((a, b) => a[1].prio - b[1].prio)

                const prioBg  = minPrio === 1 ? 'border-l-2' : minPrio === 2 ? 'border-l' : ''
                const prioColor = minPrio === 1 ? color : minPrio === 2 ? `${color}99` : '#9ca3af'

                return (
                  <div key={l1} className={`mb-3 pl-2 ${prioBg}`} style={{borderColor: prioColor}}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}/>
                      <div className="flex-1 text-[10px] font-700 uppercase tracking-wide" style={{color}}>{l1}</div>
                      {/* Priority badge */}
                      {minPrio === 1 && <span className="text-[8px] font-700 bg-orange-600 text-white rounded px-1 py-0.5">P1</span>}
                      {minPrio === 2 && <span className="text-[8px] font-700 bg-amber-400 text-white rounded px-1 py-0.5">P2</span>}
                      {minPrio >= 3 && <span className="text-[8px] font-700 bg-gray-300 text-gray-600 rounded px-1 py-0.5">P3</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 pl-3.5">
                      {l2s.map(([l2, { l3s, prio }]) => {
                        const l2Bg    = prio === 1 ? `${color}20` : prio === 2 ? `${color}10` : '#f9fafb'
                        const l2Color = prio <= 2 ? color : '#6b7280'
                        const l2Bdr   = prio <= 2 ? `${color}40` : '#e5e7eb'
                        return (
                          <div key={l2}
                            title={l3s.length ? `L3: ${l3s.join(" · ")}` : l2}
                            className="text-[9px] rounded px-1.5 py-0.5 border cursor-default leading-tight"
                            style={{background: l2Bg, color: l2Color, borderColor: l2Bdr}}>
                            {l2}
                            {l3s.length > 0 && <span className="ml-1 opacity-50">({l3s.length})</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
          </>
        )}

        {tab === 'comp' && (
          <>
            <div className="text-[9px] font-700 text-gray-400 uppercase mb-2">Principais competidores</div>
            {(COMPETITORS[code] || []).map(c => (
              <div key={c} className="flex gap-1.5 items-start mb-1.5">
                <span className="text-red-500 text-[10px] font-700 mt-0.5 flex-shrink-0">⚔</span>
                <span className="text-[11px] text-gray-700">{c}</span>
              </div>
            ))}
          </>
        )}

        {tab === 'people' && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-base font-700 text-blue-600">{TURNOVER[code] || "—"}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">Turnover anual</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-[10px] font-600 text-gray-700 leading-tight">SuccessFactors</div>
                <div className="text-[9px] text-gray-400 mt-0.5">Principal solução HCM</div>
              </div>
            </div>
            <div className="text-[9px] font-700 text-gray-400 uppercase mb-1">Contratações 2026–2027</div>
            <div className="text-[11px] text-gray-700 mb-3">{HIRING[code] || "—"}</div>
            <div className="text-[9px] font-700 text-gray-400 uppercase mb-1">SuccessFactors — argumentos</div>
            {["Workforce Planning integrado ao ERP","Learning Management para requalificação","Succession Planning para posições críticas","People Analytics de turnover integrado ao SAC"].map(a => (
              <div key={a} className="flex gap-1.5 items-start mb-1">
                <span className="text-orange-500 text-[10px] mt-0.5 flex-shrink-0">→</span>
                <span className="text-[11px] text-gray-700">{a}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function IndustryPropensityTab() {
  const [search, setSearch]       = useState('')
  const [urgFilter, setUrgFilter] = useState('all')

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['solution-catalog'],
    queryFn: () => api.get('/api/ae-analysis/solution-catalog').then(r => r.data),
    staleTime: 10 * 60_000,
  })

  // Group catalog by L1 for easy lookup
  const catalogByL1: Record<string, any[]> = useMemo(() => {
    const entries = catalogData?.catalog || []
    return entries.reduce((acc: any, e: any) => {
      acc[e.solution_l1] = acc[e.solution_l1] || []
      acc[e.solution_l1].push(e)
      return acc
    }, {})
  }, [catalogData])

  const codes = Object.keys(IND_META).filter(code => {
    const meta = IND_META[code]
    const matchU = urgFilter === 'all' || meta.urgency === urgFilter
    const matchS = !search || meta.name.toLowerCase().includes(search.toLowerCase())
    return matchU && matchS
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <span className="text-sm font-600 text-gray-700">Propensão de Investimento · América Latina 2026–2027</span>
          {!isLoading && catalogData && (
            <span className="ml-2 text-xs text-gray-400">· {catalogData.catalog?.length || 0} entradas no catálogo</span>
          )}
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          {[['all','Todos'],['high','Alta urgência'],['growing','Crescimento acelerado'],['medium','Eficiência']].map(([v,l]) => (
            <button key={v} onClick={()=>setUrgFilter(v)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${urgFilter===v?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {l}
            </button>
          ))}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar segmento..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400 w-44"/>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Carregando catálogo de soluções...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {codes.map(code => <PropCard key={code} code={code} catalogByL1={catalogByL1} />)}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400">
        Soluções carregadas da tabela <code>SOLUTION_CATALOG</code> no HANA ·
        IDC Latin America 2025–2026 · Gartner IT Spending · SAP Industry Cloud · Pipeline SAP LAC Jul/2026
      </div>
    </div>
  )
}
