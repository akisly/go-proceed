# Evidence scan: demand among ПТВ, виконроби and technical supervision

**Date:** 2026-08-21  
**Market:** Ukraine, with international construction-field evidence used only for adoption-pattern comparison  
**Method:** web search fallback because `parallel-cli` was unavailable in the environment. Search results were triangulated across current Ukrainian regulation, current job descriptions, practitioner forums, construction-software discussions, industry surveys, and the project's own discovery ledger.

## Research question

Do ПТВ engineers, foremen/site superintendents, and technical-supervision engineers have a real need for a workflow that binds required evidence to work before covering, refuses unsupported closure, generates a hidden-works act, obtains an external decision, and exposes blocked value?

This scan distinguishes four different claims:

1. the workflow is a real duty;
2. the workflow causes recurring pain;
3. software could reduce that pain;
4. a named buyer will adopt and pay for this specific product.

The evidence strongly supports 1 and 2, moderately supports 3, and does not yet support 4 for GoProceed in Ukraine.

## Ukrainian regulatory and operating duty

- Cabinet of Ministers Resolution No. 903 establishes technical supervision during construction and makes the customer responsible for providing it. The supervision function covers compliance with design decisions and standards, and the quality and volumes of performed work.  
  https://zakon.rada.gov.ua/go/903-2007-%D0%BF
- DBN A.3.1-5:2016 requires the project work plan to name the necessary as-built documentation. Its annexes include the list and mandatory form for hidden-works acts.  
  https://e-construction.gov.ua/laws_detail/3104698394124224179?doc_type=2  
  https://e-construction.gov.ua/laws_detail/3074189153571702276?doc_type=2
- The DBN form explicitly includes representatives of the construction organisation, customer technical supervision, and design organisation.  
  https://e-construction.gov.ua/laws_detail/3074189153571702276?doc_type=2
- Current Ukrainian technical-supervision contracts publicly filed in ЄДЕССБ include joint inspection of hidden work, control of as-built documentation, and prevention of following work before the hidden-work act is completed.  
  https://e-construction.gov.ua/files/upload/2024-07-12/8f75f3c6-f905-46a1-82d1-72336ec9f1b7.pdf
- The government definition of documents for performance of a construction contract includes work logs, completed-work acts, hidden-work acts, passports, certificates, testing acts, author-supervision logs, and inspection materials.  
  https://zakon.rada.gov.ua/laws/term/7563

**Inference:** this is not an invented SaaS workflow. The documentary hand-off between contractor, site execution, technical supervision and acceptance is part of the actual operating system of Ukrainian construction.

## Role evidence

### ПТВ / contractor documentation function

Recurring practitioner evidence:

- Ukrainian forum participants repeatedly ask who must prepare and sign hidden-work acts, what form applies, and what to do when the customer asks for them only at hand-over.  
  https://stroysmeta.com.ua/forum/viewthread.php?thread_id=5307  
  https://www.stroysmeta.com.ua/forum/viewthread.php?pid=9041&thread_id=1436
- Practitioner discussions describe customer-specific formatting requirements, repeated revisions, and the practical reality that documentation is changed to the customer's preference because acceptance and financing otherwise wait.  
  https://smetnoedelo.ru/forum/forum29/topic16484/
- A foreman's account describes manually typing hidden-work acts, maintaining an as-built register, and discovering that the general work log had not been maintained correctly.  
  https://klyshko.ru/akt-skrytyh-rabot/
- A current competing workflow describes ПТВ spending several days searching photos in chats, transcribing passports into Word, and calling the foreman to assemble the monthly customer folder. This is vendor evidence, not an independent measurement, but its workflow is consistent with the forum evidence.  
  https://allmazstroy.ru/servisy/masterpto/

**Need strength:** high. ПТВ is the strongest likely champion because the role suffers the aggregation, correction and return loop, and can see the connection to monthly closing.

### Foreman / work executor

Current Ukrainian job descriptions require:

- photo capture, work logs, hidden-work acts, updates to schedules, completed-work submissions, preparation for audits and technical supervision;  
  https://www.rabotniki.ua/vacancy/vikonrob-zi-svoyeyu-brigadoyu-15030
- maintaining as-built documentation, hidden-work acts, and inputs for KB-2v alongside materials, equipment, safety, schedule and crew coordination.  
  https://www.rabotniki.ua/vacancy/vikonrob-16130

International practitioner discussions consistently say site supervisors take many photos, sometimes hundreds per day, because photos may be the only later proof; the unresolved issue becomes organisation and retrieval.  
https://www.reddit.com/r/ConstructionManagers/comments/1jggi4c

**Need strength:** operationally high, adoption willingness conditional. The foreman has the evidence at the correct moment, but also has the least tolerance for administration. A product that adds fields after the same photo was already sent to Telegram creates negative value. A product that takes no more effort than sending a photo and removes later calls from ПТВ can be adopted.

### Technical supervision

Current Ukrainian job descriptions consistently include:

- checking compliance with design and DBN/DSTU;
- inspecting hidden works;
- controlling contractor as-built documentation and work logs;
- checking materials and certificates;
- signing or checking KB-2v/KB-3 and actual quantities;
- recording defects and controlling correction.

Sources:  
https://robota.ua/company15239797/vacancy11245294  
https://jobs.dou.ua/companies/techiia-holding/vacancies/359519/  
https://www.work.ua/jobs/4742450/  
https://robota.ua/company15332146/vacancy11275536

Forum evidence shows signature-authority ambiguity and refusal when a technical-supervision representative does not recognise the subcontractor or its relationship to the general contractor.  
https://forum.smeta.ru/topic3811.html  
https://stroysmeta.com.ua/forum/viewthread.php?thread_id=5307

**Need strength:** high for traceability and completeness, lower as a buyer. Technical supervision benefits from a complete, attributable record, but is unlikely to buy a subcontractor-controlled system and may resist a workflow that appears to pressure a decision. Adoption is most plausible through a no-account review link, neutral receipt, visible sources, and customer/general-contractor mandate.

## Evidence that software can help — and can also fail

Positive adoption evidence:

- In a survey during a live data-centre rollout, 85% of 27 subcontractors said the digital process improved efficiency and overall satisfaction was 4.0/5. This is a small, vendor-published sample and should not be generalised to Ukraine.  
  https://visibuild.com/news/construction-subcontractor-software-adoption-survey/
- AGC/Sage reported planned mobile use for field access to customer/job information and sharing drawings, photos and documents.  
  https://www.sage.com/en-us/blog/2024-tech-agc-sage-construction-hiring-business-outlook/
- Industry reports repeatedly associate poor document management, communication and quality controls with rework. Vendor sponsorship means the exact market-size claims should be treated cautiously; the directional finding is consistent across sources.  
  https://www.planradar.com/us/industry-report/rework/  
  https://www.autodesk.com/blogs/construction/construction-disconnected-fmi-report/  
  https://www.construction.com/resource/not-by-design-the-true-cost-of-poor-collaboration/

Negative/adoption-risk evidence:

- Practitioners report returning to texts and spreadsheets after trying several tools because field and office remain disconnected and reporting still requires manual work.  
  https://www.reddit.com/r/ConstructionTech/comments/1jle1je/we_tried_5_tools_still_managing_projects_in_texts/
- Construction managers repeatedly describe enterprise suites as expensive, slow, cluttered, or overbuilt. Several state that the process collapses if field personnel do not use the selected software.  
  https://www.reddit.com/r/ConstructionTech/comments/1gpduna/absolutely_done_with_procore/  
  https://www.reddit.com/r/ConstructionManagers/comments/1aocj9c/construction_management_software_recommendations/  
  https://www.reddit.com/r/Construction/comments/tjqdip/construction_management_software/
- A 2026 survey of 100 construction companies reported lack of training and expertise as the primary adoption barrier for 70% of respondents. This is a commercial report and should be treated as indicative.  
  https://www.dedale.com/reports/construction-management-software-survey

**Inference:** demand is for fewer calls, fewer returns, faster retrieval and defensible proof. There is no general demand for “one more construction application.” Adoption depends more on workflow fit than feature count.

## Ukraine-specific market signal and its limit

The GoProceed discovery ledger currently records:

- eight market assumptions, all still unvalidated;
- 21 evidenced outreach sends and zero recorded replies/interviews/named projects/pilot commitments/willingness-to-pay signals as of the ledger's review;
- a founder-reported signal that several companies confirmed the problem and use Telegram for photographs, but without company names, dates, notes or customer documents.

Sources:  
../docs/discovery/validated-assumptions.md  
../docs/discovery/outreach-log.md

This is more probative for GoProceed than generic market reports. Public research validates that the duty and pain exist; it does not validate that the proposed product, wording, gate or price is accepted by the target segment.

## Demand assessment

| Role | Real duty | Recurring pain | Likely product champion | Likely payer | Adoption risk |
|---|---|---|---|---|---|
| ПТВ | High | High | High | Medium | Medium |
| Foreman | High | Medium–high | Low–medium | Low | High if duplicate entry or slow capture |
| Technical supervision | High | High accountability burden | Medium if neutral/customer-mandated | Low | High if contractor-controlled or account-heavy |
| Subcontractor owner/commercial director | Indirect | High when acceptance delays cash | High economic buyer | High | Needs visible blocked value and cycle-time evidence |
| General contractor/customer | High governance interest | High at scale | Medium–high | Medium–high | Requires integration and control over rules |

## Falsifiable conclusion

There is a credible need for the workflow, strongest in specialist subcontractors that have repeated hidden works, a real technical-supervision counterparty, and monthly acceptance/payment pressure. There is not yet validated demand for GoProceed as an application.

The narrowest useful product hypothesis is:

> If a foreman can capture the required proof in no more time than sending a Telegram photo, ПТВ can produce the act without searching chats or retyping facts, and technical supervision can accept or return it without an account, then the subcontractor will reduce returned documentation and time from performed work to accepted work.

The hypothesis should be tested against one named project and the last five actual returns/delays, not through a feature survey.

## Minimum next evidence

For 5–8 interviews, request artifacts rather than opinions:

1. one real redacted hidden-work act and its attachments;
2. the last five returned acts/packages and the exact reasons;
3. photos/messages used to reconstruct one act;
4. time between work completion, first submission, signature and payment inclusion;
5. who called whom, and how many times;
6. whether the foreman captured before covering or ПТВ reconstructed later;
7. whether technical supervision would open a no-account link from the subcontractor;
8. who has authority and budget to mandate the workflow.

A pilot is justified only if at least one company provides a real artifact and names a project where a hidden-work cycle will occur in the next 30 days.
