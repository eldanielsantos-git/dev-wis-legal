export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'payment' | 'subscription';
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_TmQrnmCSzpI5PA',
    priceId: 'price_1Sos07EFAH2hhQ6HdYYMWDLm',
    name: 'Wis Legal +2 Milhões de Tokens',
    description: '+2 Milhões de Tokens',
    price: 76.00,
    currency: 'BRL',
    mode: 'payment'
  },
  {
    id: 'prod_TmQqoDEwJjRBnH',
    priceId: 'price_1SorylEFAH2hhQ6HdaJ9O7f6',
    name: 'Wis Legal +1 Milhão de Tokens',
    description: '+1 Milhão de Tokens',
    price: 38.00,
    currency: 'BRL',
    mode: 'payment'
  },
  {
    id: 'prod_TmQoi4gpObgGfZ',
    priceId: 'price_1SorwnEFAH2hhQ6HyoN8SFbb',
    name: 'Wis Legal Elite',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises, Chat com o processo, 60 Milhões de tokens',
    price: 759.00,
    currency: 'BRL',
    mode: 'subscription'
  },
  {
    id: 'prod_TmQny1eV4BU7Iz',
    priceId: 'price_1SorvcEFAH2hhQ6HgX4GA8Nx',
    name: 'Wis Legal Pro',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises, Chat com o processo, 24 Milhões de tokens',
    price: 309.00,
    currency: 'BRL',
    mode: 'subscription'
  },
  {
    id: 'prod_TmQlkZw05fccIS',
    priceId: 'price_1Soru2EFAH2hhQ6HsDF43Tyq',
    name: 'Wis Legal Premium',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises, Chat com o processo, 12 Milhões de tokens',
    price: 159.00,
    currency: 'BRL',
    mode: 'subscription'
  },
  {
    id: 'prod_TmQkYB1A3sUicW',
    priceId: 'price_1SorsoEFAH2hhQ6Hccp8Bx1r',
    name: 'Wis Legal Essencial',
    description: 'Análise com IA de processos completos, Mapeamento dos pontos-chave, Sumário contextual do processo, Insights para estratégia processual, Sugestões de teses e fundamentos, Indicação de precedentes relevantes, Análise de riscos e viabilidade, Identificação de recursos viáveis, Histórico seguro de análises, Chat com o processo, 4,4 Milhões de tokens',
    price: 59.00,
    currency: 'BRL',
    mode: 'subscription'
  }
];

export const getTokenProducts = () => STRIPE_PRODUCTS.filter(p => p.mode === 'payment');
export const getSubscriptionProducts = () => STRIPE_PRODUCTS.filter(p => p.mode === 'subscription');
export const getProductByPriceId = (priceId: string) => STRIPE_PRODUCTS.find(p => p.priceId === priceId);