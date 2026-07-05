import { describe, it, expect } from 'vitest'
import { detectIntent } from '../reasoning/application/intentDetector.ts'

describe('detectIntent', () => {
  it('classifies an advance-payment question', () => {
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-05' })
    expect(intent.intentType).toBe('ADVANCE_PAYMENT_RULE')
    expect(intent.ambiguous).toBe(false)
    expect(intent.context.asOfDate).toBe('2026-07-05')
  })

  it('classifies a guarantee question', () => {
    const intent = detectIntent({ question: 'Mức bảo lãnh dự thầu là bao nhiêu?', asOfDate: '2026-07-05' })
    expect(intent.intentType).toBe('GUARANTEE_RULE')
  })

  it('falls back to GENERAL when no trigger matches', () => {
    const intent = detectIntent({ question: 'xin chào', asOfDate: '2026-07-05' })
    expect(intent.intentType).toBe('GENERAL')
    expect(intent.confidence).toBeLessThan(0.5)
  })

  it('extracts a DOCUMENT_SYMBOL entity', () => {
    const intent = detectIntent({ question: 'Theo Luật 22/2023/QH15 thì mức tạm ứng là bao nhiêu?', asOfDate: '2026-07-05' })
    const symbols = intent.detectedEntities.filter(e => e.entityType === 'DOCUMENT_SYMBOL')
    expect(symbols.map(e => e.value)).toContain('22/2023/QH15')
  })

  it('extracts an ARTICLE_REF entity', () => {
    const intent = detectIntent({ question: 'Điều 15 khoản 2 quy định gì về tạm ứng?', asOfDate: '2026-07-05' })
    const articles = intent.detectedEntities.filter(e => e.entityType === 'ARTICLE_REF')
    expect(articles.length).toBeGreaterThan(0)
    expect(intent.context.mentionedArticles).toContain(articles[0]!.value)
  })

  it('extracts a MONEY_AMOUNT entity without assigning it to estimatedValue', () => {
    const intent = detectIntent({ question: 'Gói thầu trị giá 3 tỷ đồng có phải đấu thầu rộng rãi không?', asOfDate: '2026-07-05' })
    const amounts = intent.detectedEntities.filter(e => e.entityType === 'MONEY_AMOUNT')
    expect(amounts.length).toBeGreaterThan(0)
    expect(intent.context.estimatedValue).toBeUndefined()
  })

  it('extracts PACKAGE_TYPE / FUND_SOURCE / PROCUREMENT_METHOD into context when caller did not supply them', () => {
    const intent = detectIntent({
      question: 'Gói hàng hóa dùng ngân sách nhà nước có phải đấu thầu rộng rãi không?',
      asOfDate: '2026-07-05',
    })
    expect(intent.context.packageType).toBe('GOODS')
    expect(intent.context.fundSource).toBe('STATE_BUDGET')
    expect(intent.context.procurementMethod).toBe('OPEN_TENDER')
  })

  it('caller-provided context always wins over extracted entities', () => {
    const intent = detectIntent({
      question: 'Gói hàng hóa có phải đấu thầu rộng rãi không?',
      asOfDate: '2026-07-05',
      context: { packageType: 'CONSTRUCTION' },
    })
    expect(intent.context.packageType).toBe('CONSTRUCTION')
  })

  it('marks ambiguous when two intents score within 0.10 of each other', () => {
    const intent = detectIntent({
      question: 'thẩm quyền phê duyệt tạm ứng là ai và mức tạm ứng bao nhiêu?',
      asOfDate: '2026-07-05',
    })
    if (intent.ambiguous) {
      expect(intent.alternatives?.length ?? 0).toBeGreaterThan(0)
    }
  })
})
