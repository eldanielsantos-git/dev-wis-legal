export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'subscription' | 'payment';
  tokens: string;
  pageLimit: string;
  recommended?: boolean;
}

export interface TokenPackage {
  id: string;
  priceId: string;
  name: string;
  tokens: string;
  price: number;
  checkoutUrl?: string;
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_TCSvtM9pDVEFS9',
    priceId: 'price_1SG3zEJrr43cGTt4oUj89h9u',
    name: 'Essencial',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises',
    price: 59.00,
    currency: 'BRL',
    mode: 'subscription',
    tokens: '1,2 Milhão de tokens',
    pageLimit: 'Limite aproximado 220 páginas'
  },
  {
    id: 'prod_TCSwuloaO4vRHL',
    priceId: 'price_1SG40ZJrr43cGTt4SGCX0JUZ',
    name: 'Premium',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises',
    price: 159.00,
    currency: 'BRL',
    mode: 'subscription',
    tokens: '4 Milhões de tokens',
    pageLimit: 'Limite aproximado 750 páginas',
    recommended: true
  },
  {
    id: 'prod_TCSxhO2q0Ildqh',
    priceId: 'price_1SG41xJrr43cGTt4MQwqdEiv',
    name: 'Pro',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises',
    price: 309.00,
    currency: 'BRL',
    mode: 'subscription',
    tokens: '8 Milhões de tokens',
    pageLimit: 'Limite aproximado 1.500 páginas'
  },
  {
    id: 'prod_TCSzedbK2kedbR',
    priceId: 'price_1SG43JJrr43cGTt4URQn0TxZ',
    name: 'Elite',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises',
    price: 759.00,
    currency: 'BRL',
    mode: 'subscription',
    tokens: '20 Milhões de tokens',
    pageLimit: 'Limite aproximado 3.700 páginas'
  }
];

export const tokenPackages: TokenPackage[] = [
  {
    id: 'prod_TCZYC41p0xOw3O',
    priceId: 'price_1SGAPJJrr43cGTt4r7k4qYZe',
    name: '1,2 Milhão de Tokens',
    tokens: '1.200.000 tokens',
    price: 38.00,
    checkoutUrl: 'https://buy.stripe.com/14A9AU7EE4HedohczU7Re09'
  },
  {
    id: 'prod_TCZZzd2SrGSDlD',
    priceId: 'price_1SGAQHJrr43cGTt4dKkvB9lD',
    name: '2 Milhões de Tokens',
    tokens: '2.000.000 tokens',
    price: 76.00,
    checkoutUrl: 'https://buy.stripe.com/28E14o2kk0qY5VP2Zk7Re0a'
  }
];