"""Build BIOracle's static website from the consolidated source material."""
from pathlib import Path
from html import escape
import json
from hashlib import sha256
import os
import re
import shutil
from urllib.parse import urlsplit
from archive_protection import ArchiveProtection
from business_model import render_business_model, render_contract_page
from accounts import account_dialog, write_account_config

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DATA = json.loads((ROOT / 'content/site.json').read_text())
EMAIL = 'pgerrish@unm.edu'
URL = os.environ.get('BIORACLE_SITE_URL', 'https://bioracle.philip-gerrish.chatgpt.site').rstrip('/')
BASE_PATH = urlsplit(URL).path.rstrip('/')
ARROW = '<span aria-hidden="true">↗</span>'
PAGES = []
ARCHIVE = ArchiveProtection(ROOT)
write_account_config(ROOT, DIST, BASE_PATH)


def e(value):
    return escape(str(value), quote=True)


def brand():
    return '<span class="brand-symbol"><img src="/assets/bioracle-logo.png" alt="" width="1254" height="1254"></span><span class="brand-word"><b>BI</b>Oracle</span>'


def button(label, href, quiet=False):
    return f'<a class="button {"button-quiet" if quiet else ""}" href="{e(href)}">{e(label)}{ARROW}</a>'


def text_link(label, href):
    return f'<a class="text-link" href="{e(href)}">{e(label)}{ARROW}</a>'


def header(active):
    items = [('About', '/about/'), ('Contract', '/contract/'), ('Research', '/research/'), ('Approach', '/approach/'), ('Consortium', '/consortium/'), ('Publications', '/publications/')]
    nav_items = []
    for name, href in items:
        current = 'aria-current="page"' if active == name.lower() else ''
        nav_items.append(f'<a href="{href}" {current}>{name}</a>')
    nav = ''.join(nav_items)
    return f'''<a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header"><a class="brand" href="/" aria-label="BIOracle home">{brand()}</a>
      <button class="menu-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="navigation" type="button"><span>Menu</span><span class="menu-lines" aria-hidden="true"></span></button>
      <nav id="navigation" aria-label="Main navigation">{nav}<a class="nav-work" href="/contact/">Let’s talk {ARROW}</a><button type="button" class="nav-login" data-account-button>Log in</button></nav>
    </header>'''


def footer():
    return f'''<footer class="site-footer wrap"><div class="footer-top"><div><a class="brand" href="/" aria-label="BIOracle home">{brand()}</a><p>taming risk the way nature does</p></div>
      <div class="footer-links"><a href="/about/">About</a><a href="/research/">Research</a><a href="/consortium/">Consortium</a><a href="/consulting/">Consulting</a><a href="/publications/">Publications</a><a href="/contact/">Contact</a></div></div>
      <div class="footer-bottom"><span>© 2026 BIOracle · Company & research consortium</span><a href="/archive/">Source archive</a><a href="#top">Back to top ↑</a></div></footer>'''


def write_page(path, title, description, content, active='', body_class='', scripts=()):
    path = '/' + path.strip('/') + '/' if path.strip('/') else '/'
    extra_head = ''.join(f'<script src="{e(src)}" defer></script>' for src in scripts)
    if path.startswith('/archive/'):
        # Only ciphertext contains archive records, including direct profile URLs.
        protected_content = content
        for name in ('analytics-source.zip', 'lab-source.zip', 'source-records.json', 'source-publications.bib'):
            protected_content = protected_content.replace(
                f'href="/assets/{name}"',
                f'data-archive-download="{name}" href="/archive/downloads/{name}.enc"')
        if BASE_PATH:
            protected_content = re.sub(r'\b(href|src)="(/(?!/)[^"]*)"',
                lambda match: f'{match.group(1)}="{BASE_PATH}{match.group(2)}"', protected_content)
        ARCHIVE.pages[path] = dict(title=title, content=protected_content)
        title = 'Private archive'
        description = 'Enter the archive password to view the original source material.'
        content = page_intro('Source archive', 'Private archive.', description)
        content += '''<section class="wrap narrow"><form id="archive-unlock">
          <div class="form-field"><label for="archive-password">Archive password</label>
          <input id="archive-password" name="password" type="password" autocomplete="current-password" required aria-describedby="archive-status"></div>
          <button class="button" type="submit">Unlock archive <span aria-hidden="true">↗</span></button>
          <p id="archive-status" class="form-status" role="status" aria-live="polite"></p>
          <noscript><p>Enable JavaScript to unlock the archive.</p></noscript>
        </form></section>'''
        config = json.dumps(dict(base=BASE_PATH, page=path)).replace('<', '\\u003c')
        extra_head = f'<meta name="robots" content="noindex,nofollow"><script id="archive-config" type="application/json">{config}</script><script src="/archive-unlock.js" defer></script>'
    # Stable page-specific scattering; navigation never reshuffles the artwork.
    sketch_seed = int(sha256(path.encode()).hexdigest()[:8], 16)
    sketch_offset = 0 if path == '/' else sketch_seed % 1881
    sketch_x = 50 if path == '/' else 25 + (sketch_seed // 1881) % 51
    destination = DIST / path.strip('/') / 'index.html'
    destination.parent.mkdir(parents=True, exist_ok=True)
    doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{e(title)}{' | BIOracle' if title != 'BIOracle' else ' — Taming risk the way nature does'}</title><meta name="description" content="{e(description)}"><meta name="theme-color" content="#f5f3ed">
    <link rel="canonical" href="{URL}{path}"><meta property="og:type" content="website"><meta property="og:title" content="{e(title)} | BIOracle"><meta property="og:description" content="{e(description)}"><meta property="og:image" content="{URL}/assets/scattered-pencil-evolution-equations.webp"><meta property="og:url" content="{URL}{path}">
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="/assets/P052-Roman.woff" as="font" type="font/woff" crossorigin><link rel="preload" href="/assets/NimbusSans-Regular.woff" as="font" type="font/woff" crossorigin>
    <link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/atmosphere.css"><script src="/site.js" defer></script><script src="/vendor/supabase-2.116.0.js" defer></script><script src="/account-config.js" defer></script><script src="/accounts.js" defer></script>{extra_head}</head>
    <body id="top" class="{e(body_class)}" style="--sketch-offset:-{sketch_offset}px;--sketch-x:{sketch_x}%">{header(active)}<main id="main">{content}</main>{footer()}{account_dialog()}<div id="notification" class="notification" role="status" aria-live="polite"></div></body></html>'''
    if BASE_PATH:
        doc = re.sub(r'\b(href|src)="(/(?!/)[^"]*)"', lambda match: f'{match.group(1)}="{BASE_PATH}{match.group(2)}"', doc)
    destination.write_text(doc)
    PAGES.append(path)


def page_intro(kicker, title, subtitle, extra=''):
    return f'''<section class="page-intro wrap"><p class="eyebrow">{e(kicker)}</p><h1>{title}</h1><div class="intro-bottom"><p class="lead">{e(subtitle)}</p>{extra}</div></section>'''


def contact_band():
    return f'''<section class="contact-band wrap"><div><p class="eyebrow">A question worth asking</p><h2>What do you need<br>to see coming?</h2></div><div><p>Bring us a system, a question, or a collaboration.<br>We’ll start with the future you need to understand.</p>{button('Start a conversation', '/contact/')}</div></section>'''


def forecast():
    return '''<div class="forecast glass"><div class="forecast-top"><span class="eyebrow">A view of possible futures</span><span class="figure-no">Fig. 01</span></div>
    <svg viewBox="0 0 640 300" class="forecast-chart" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">An illustrative evolutionary forecast</title><desc id="chart-desc">An observed trajectory branches into possible future paths. Longer horizons show a wider range of possible outcomes. This is a conceptual illustration, not empirical data.</desc>
    <defs><linearGradient id="fan-fill" x1="0" x2="1"><stop offset="0" stop-color="#5c8078" stop-opacity=".04"/><stop offset="1" stop-color="#5c8078" stop-opacity=".18"/></linearGradient></defs>
    <path d="M35 250H610M35 40V250" class="chart-axis"/><path d="M260 30V253" class="chart-now"/>
    <path id="forecast-fan" d="M260 181 Q410 155 600 98 L600 226 Q410 200 260 181Z" fill="url(#fan-fill)"/>
    <path d="M35 230C80 232 85 213 120 217S170 183 194 194S232 170 260 181" class="chart-history"/>
    <path id="forecast-upper" d="M260 181Q410 155 600 98" class="chart-path"/><path id="forecast-mid" d="M260 181Q410 168 600 155" class="chart-path chart-path-middle"/><path id="forecast-lower" d="M260 181Q410 200 600 226" class="chart-path"/>
    <circle cx="260" cy="181" r="4" fill="#315b52"/><text x="35" y="280">Observed</text><text x="250" y="280">Now</text><text x="535" y="280">Possible futures</text></svg>
    <div class="forecast-controls" role="group" aria-label="Forecast horizon"><button type="button" data-horizon="near" aria-pressed="true">Near term</button><button type="button" data-horizon="mid" aria-pressed="false">Mid term</button><button type="button" data-horizon="long" aria-pressed="false">Extended</button></div>
    <p class="figure-caption" id="forecast-caption" aria-live="polite">Shorter horizons bring a narrower range of plausible outcomes.</p><p class="micro-note">Conceptual illustration · not empirical data</p></div>'''


def home():
    domains = [
        ('01', 'Biological systems', 'From molecular change to microbial communities, immunity, and cancer.', '/research/?focus=biology'),
        ('02', 'Markets & economies', 'Competing strategies, changing environments, and the emergence of risk.', '/research/markets/'),
        ('03', 'Adaptive intelligence', 'Learning agents, feedback, and the evolution of digital behavior.', '/research/ai/'),
        ('04', 'Evolutionary forecasting', 'Mathematical theory that turns observations into possible futures.', '/research/forecasting/'),
    ]
    rows = ''.join(f'<a class="domain-row" href="{href}"><span class="index">{n}</span><div><h3>{title}</h3><p>{desc}</p></div>{ARROW}</a>' for n, title, desc, href in domains)
    content = f'''<section class="hero"><div class="hero-content wrap"><p class="eyebrow">BIOracle · Company & research consortium</p><h1><span class="hero-headline">Hacking nature's creativity</span><em>and speeding it up.</em></h1><p class="hero-tagline">Taming risk the way evolution does</p><p class="hero-description">Evolutionary intelligence for a changing world.<br>Across biology, markets, and artificial intelligence.</p><div class="hero-actions">{button('Explore our work', '/research/')}{text_link('Meet the consortium', '/consortium/')}</div></div><div class="hero-caption wrap"><span>One theory. A world of applications.</span><span>Biology · Markets · Intelligence</span></div></section>
    <section class="section wrap" id="our-work"><div class="section-heading"><div><p class="eyebrow">01 / Our field of view</p><h2>A common theory.<br>Many possible futures.</h2></div><p>Evolution reaches beyond the living world. We study the principles that shape change—and use them to ask what comes next.</p></div><div class="domain-list">{rows}</div></section>
    <section class="section approach-section"><div class="wrap approach-grid"><div><p class="eyebrow">02 / Our approach</p><h2>Understand change.<br><em>Anticipate consequence.</em></h2><p class="body-copy">We bring mathematics, computer science, and evolutionary biology to systems that adapt. Our work connects mechanisms with evidence, and forecasts with the decisions they inform.</p><div class="method-steps"><div><span>01</span><p><strong>Frame the question.</strong> Define the system, the decision, and the timescale.</p></div><div><span>02</span><p><strong>Model the mechanisms.</strong> Connect variation, selection, and chance.</p></div><div><span>03</span><p><strong>Learn and reassess.</strong> Compare possible futures with new observations.</p></div></div>{text_link('Discover our approach', '/approach/')}</div>{forecast()}</div></section>
    <section class="section wrap"><div class="section-heading"><div><p class="eyebrow">03 / The way we work</p><h2>Independent thinking.<br>Collective discovery.</h2></div><p>A company and a research consortium, connecting fundamental questions with practical decisions.</p></div><div class="two-paths"><article class="path-panel glass"><span class="index">The company / 01</span><h3>Applied foresight.</h3><p>Focused research, custom models, and evolutionary risk assessment for organizations facing a changing landscape.</p>{text_link('Work with BIOracle', '/consulting/')}</article><article class="path-panel path-panel-green"><span class="index">The consortium / 02</span><h3>Shared questions.</h3><p>An international community of researchers connecting disciplines, developing theory, and training the next generation.</p>{text_link('Explore the consortium', '/consortium/')}</article></div></section>{contact_band()}'''
    write_page('', 'BIOracle', 'Taming risk the way nature does. Evolutionary intelligence across biology, financial markets, and artificial intelligence.', content, body_class='home')


RESEARCH_META = {
    'dna-rna': ('DNA / RNA evolution', 'biology', 'Molecular histories, phylogenetics, and the structure of genetic change.'),
    'cancer': ('Somatic evolution & cancer', 'biology', 'Clonal competition, tumor diversity, and the evolution of treatment resistance.'),
    'microbes': ('Microbial evolution', 'biology', 'Adaptation, gene exchange, and the dynamics of microbial communities.'),
    'immunity': ('Immunity & coevolution', 'biology', 'Immune diversity, host defense, and evolutionary trade-offs.'),
    'markets': ('Financial markets', 'markets', 'Markets as evolving systems of competing strategies and institutions.'),
    'forecasting': ('Evolutionary forecasting', 'methods', 'Learning from variation to anticipate change in large, noisy systems.'),
    'biosecurity': ('Biological risk & resilience', 'biology', 'Safeguard stability, containment reliability, and evidence for preparedness.'),
    'ai': ('Adaptive AI & learning agents', 'intelligence', 'Feedback, changing incentives, and the behavior of systems that keep learning.'),
}


def research():
    rows = ''
    for i, (slug, (title, category, desc)) in enumerate(RESEARCH_META.items(), 1):
        rows += f'<a class="research-row" data-research data-category="{category}" href="/research/{slug}/"><span class="index">{i:02}</span><div><span class="small-label">{category}</span><h2>{e(title)}</h2><p>{e(desc)}</p></div>{ARROW}</a>'
    content = page_intro('Research / An interconnected programme', 'Different systems.<br><em>A shared evolutionary logic.</em>', 'From molecules to markets, we examine how variation, selection, and interaction shape the future.')
    content += f'''<section class="wrap section research-index"><div class="filter-bar" role="group" aria-label="Filter research"><button type="button" data-research-filter="all" aria-pressed="true">All research</button><button type="button" data-research-filter="biology" aria-pressed="false">Biology</button><button type="button" data-research-filter="markets" aria-pressed="false">Markets</button><button type="button" data-research-filter="intelligence" aria-pressed="false">Intelligence</button><button type="button" data-research-filter="methods" aria-pressed="false">Methods</button></div><div class="research-rows">{rows}</div><p class="sr-only" id="research-count" role="status">8 research areas</p></section>
    <section class="section wrap research-foundation"><p class="eyebrow">Our foundation</p><div class="three-columns"><div><span class="discipline-symbol">∑</span><h3>Mathematics</h3><p>Probability, dynamical systems, and quantitative reasoning reveal structure beneath complexity.</p></div><div><span class="discipline-symbol">{'{ }'}</span><h3>Computer science</h3><p>Simulation, statistical inference, and learning methods make alternative futures tractable.</p></div><div><span class="discipline-symbol">Δ</span><h3>Evolutionary biology</h3><p>Variation, inheritance, selection, and ecological context connect forecasts with mechanisms of change.</p></div></div></section>{contact_band()}'''
    write_page('research', 'Research', 'An interconnected research programme across evolutionary biology, biological risk, financial markets, and adaptive AI.', content, 'research')


def research_detail(item):
    slug = item['slug']
    related = [x for x in RESEARCH_META if x != slug][:3]
    areas = ''
    for n, text in enumerate(item['areas'], 1):
        title, _, description = text.partition(':')
        areas += f'<div class="research-question"><span class="index">{n:02}</span><div><h3>{e(title)}</h3><p>{e(description.strip())}</p></div></div>'
    projects = ''.join(f'<article class="project-item"><h3>{e(p["title"])}</h3><p>{e(p["description"])}</p></article>' for p in item['projects'])
    content = page_intro('Research / ' + RESEARCH_META[slug][1], e(RESEARCH_META[slug][0]), item['subtitle'], text_link('All research', '/research/'))
    content += f'''<section class="wrap detail-layout"><article class="detail-main"><p class="eyebrow">Overview</p><p class="article-lead">{e(item['overview'])}</p><div class="article-section"><h2>Questions we explore.</h2>{areas}</div><div class="article-section"><h2>Methods & perspective.</h2><p>{e(item['methods'])}</p></div><div class="article-section"><p class="eyebrow">Research directions</p><div class="project-list">{projects}</div></div></article><aside class="detail-aside glass"><p class="eyebrow">Connect the ideas</p><h3>Part of a wider conversation.</h3><p>Our research connects theory, computation, and observation across disciplines.</p>{text_link('Meet the consortium', '/consortium/')}{text_link('Read selected work', '/publications/')}{text_link('Discuss a research project', '/contact/?type=Research+collaboration')}</aside></section><section class="wrap section related"><p class="eyebrow">Continue exploring</p>{''.join(text_link(RESEARCH_META[s][0], '/research/'+s+'/') for s in related)}</section>{contact_band()}'''
    write_page('research/'+slug, RESEARCH_META[slug][0], item['subtitle'], content, 'research')


def risk_research():
    rows = ''
    for i, item in enumerate(DATA['risk_research'], 1):
        slug = ['containment', 'safeguards', 'spillover', 'interactions', 'early-warning'][i-1]
        title = ['Containment reliability', 'Biological safeguard stability', 'Spillover risk', 'Ecological & host interactions', 'Evolutionary early warning'][i-1]
        description = [
            'How does containment reliability change over time? We study the evolutionary and environmental conditions that inform review intervals and reassessment.',
            'Will a built-in safety mechanism retain its intended function as a population evolves? We examine the effects of mutation, selection, and fitness trade-offs on safeguard durability.',
            'What changes when an organism encounters an unintended setting? We model persistence and interaction in the context of ecological communities and host responses.',
            'How do interactions alter the risk picture? We examine host responses, microbiome perturbations, ecological competition, and effects that emerge at the system level.',
            'Which observations should prompt a closer look? We connect evolutionary trajectories with monitoring priorities and evidence for timely reassessment.',
        ][i-1]
        rows += f'<a class="research-row" href="/research/biosecurity/{slug}/"><span class="index">{i:02}</span><div><h2>{title}</h2><p>{description}</p></div>{ARROW}</a>'
        lists = ''.join(f'<div><h3>{heading}</h3><ul class="plain-list">'+''.join(f'<li>{e(s)}</li>' for s in item[key])+'</ul></div>' for heading, key in [('Questions & challenges', 'challenges'), ('Mathematical approaches', 'approaches'), ('Applications', 'applications')])
        detail = page_intro('Research / Biological risk & resilience', title, description, text_link('Risk programme', '/research/biosecurity/'))
        detail += f'<section class="wrap section three-columns detail-lists">{lists}</section><section class="wrap article-section narrow"><h2>Mechanisms, evidence, and uncertainty.</h2><p>Population genetics, stochastic processes, mathematical modeling, and comparison with observations connect this question to our wider forecasting programme.</p>{text_link("Explore our methods", "/approach/")}</section>{contact_band()}'
        write_page('research/biosecurity/'+slug, title, description, detail, 'research')
    concepts = ''.join(f'<details class="concept"><summary>{e(c["term"])}<span aria-hidden="true">+</span></summary><p>{e(c["definition"])}</p></details>' for c in DATA['risk_context']['keyConcepts'])
    content = page_intro('Research / Biological risk & resilience', 'Evolution continues<br><em>after design.</em>', 'We examine how biological systems change over time, and what that means for safeguard reliability, environmental interactions, and preparedness.', text_link('All research', '/research/'))
    content += f'<section class="wrap research-rows section">{rows}</section><section class="wrap section two-columns"><div><p class="eyebrow">A common language</p><h2>Key concepts.<br>Clear meanings.</h2><p>Mathematical models make their assumptions explicit. A shared vocabulary helps connect forecasts with decisions.</p></div><div>{concepts}</div></section>{contact_band()}'
    write_page('research/biosecurity', 'Biological risk & resilience', RESEARCH_META['biosecurity'][2], content, 'research')


def ai():
    areas = [('Behavioral drift', 'Study how behavior changes through repeated feedback, updates, and interaction.'), ('Incentives & selection', 'Examine how competing objectives and environmental pressures shape adaptive behavior.'), ('Monitoring & stability', 'Ask which observations reveal a changing system and when a forecast needs reassessment.'), ('Higher-order evolution', 'Explore how the processes that generate variation and learning can themselves change over time.')]
    questions = ''.join(f'<div class="research-question"><span class="index">{i:02}</span><div><h3>{title}</h3><p>{desc}</p></div></div>' for i, (title, desc) in enumerate(areas, 1))
    content = page_intro('Research / Adaptive intelligence', 'What happens as a learning<br><em>agent keeps learning?</em>', 'We study the changing behavior of adaptive digital systems through evolutionary theory, probability, and computation.', text_link('All research', '/research/'))
    content += f'<section class="wrap detail-layout"><article class="detail-main"><p class="article-lead">Recursive-learning bots change through repeated feedback and updates. We examine how behavior drifts, how incentives shape adaptation, and how monitoring can keep pace with an evolving system.</p><div class="article-section"><h2>Questions we explore.</h2>{questions}</div><div class="article-section"><h2>Evolution beyond the living world.</h2><p>Our laboratory brings evolutionary theory into conversation with artificial intelligence. First-order evolution has been compared with a “blind watchmaker.” Higher-order processes can change how variation and adaptation occur. We ask how these ideas can inform the study of systems that learn.</p></div></article><aside class="detail-aside glass"><p class="eyebrow">Biological × digital</p><h3>A connected perspective.</h3><p>Different mechanisms can share a common mathematical language. The distinctions matter as much as the similarities.</p>{text_link("Evolutionary forecasting", "/research/forecasting/")}{text_link("Discuss adaptive AI", "/contact/?type=Adaptive+AI+project")}</aside></section>{contact_band()}'
    write_page('research/ai', 'Adaptive AI & learning agents', RESEARCH_META['ai'][2], content, 'research')


def about():
    content = page_intro(
        'About BIOracle / Our mission',
        'A company. A consortium.<br><em>An academy.</em>',
        'Our mission is to turn an understanding of evolving systems into useful tools, '
        'new knowledge, and opportunities to learn. We bring entrepreneurship, academic '
        'research, and teaching into one working community: a new organizational response '
        'to a world being reshaped by artificial intelligence.',
        f'<div class="about-intro-links"><a class="text-link" href="/mission/" target="_blank" rel="noopener noreferrer">Full mission statement<span class="sr-only"> (opens in a new tab or window)</span>{ARROW}</a><a class="text-link" href="/business-model/" target="_blank" rel="noopener noreferrer">Our business model<span class="sr-only"> (opens in a new tab or window)</span>{ARROW}</a><a class="text-link" href="/contract/">Contract <span aria-hidden="true">↓</span></a></div>',
    )
    model = [
        ('01', 'Entrepreneurship',
         'Build tools and pursue applied projects that answer real questions. Work with '
         'partners to turn scientific insight into useful capabilities and bring practical '
         'problems back into research.'),
        ('02', 'Academic inquiry',
         'Protect the freedom to ask fundamental questions, test assumptions, and share '
         'findings. Connect independent researchers and universities across disciplines '
         'while keeping evidence and scientific rigor central.'),
        ('03', 'Teaching & mentorship',
         'Learn through participation in real research and development. Apprenticeship '
         'and close mentorship cultivate mathematical understanding, critical judgment, '
         'and the ability to question and verify AI-assisted work.'),
    ]
    model_cards = ''.join(
        f'<article><span class="index">{number}</span><h3>{e(title)}</h3><p>{e(description)}</p></article>'
        for number, title, description in model
    )
    foundations = [
        ('01', 'Darwinian evolution',
         'Variation, inheritance, and selection explain how populations adapt. We study '
         'these mechanisms in biology and test where they illuminate evolving strategies '
         'and adaptive digital systems.'),
        ('02', 'Self-organized criticality',
         'We investigate when interacting systems organize near critical states, where '
         'small disturbances can trigger cascades across scales. This perspective helps '
         'us ask how collective behavior shapes instability and risk.'),
        ('03', 'Non-equilibrium statistical mechanics',
         'We study fluctuations, flows, and stochastic dynamics in systems driven away '
         'from equilibrium. This provides tools for understanding how patterns arise, '
         'persist, and change under ongoing forces.'),
    ]
    foundation_cards = ''.join(
        f'<article><span class="index">{number}</span><h3>{e(title)}</h3><p>{e(description)}</p></article>'
        for number, title, description in foundations
    )
    content += f'''<section class="wrap section about-model" aria-labelledby="model-title">
      <div class="section-heading"><div><p class="eyebrow">Our working model</p><h2 id="model-title">Research, enterprise,<br><em>and learning together.</em></h2></div><p>AI changes what we can build and how we investigate and learn. Our model lets practical work generate research questions, research improve tools, and teaching renew both.</p></div>
      <div class="three-columns about-pillars">{model_cards}</div>
      <p class="about-note">Education belongs within the work itself, through shared inquiry and mentorship. We embrace entrepreneurial thinking while rejecting a for-profit model of education.</p>
    </section>
    <section class="wrap section about-foundations" aria-labelledby="foundations-title">
      <div class="section-heading"><div><p class="eyebrow">Our three-pronged approach</p><h2 id="foundations-title">Three foundations.<br><em>A connected perspective.</em></h2></div><p>Adaptation, collective instability, and driven dynamics offer complementary ways to understand changing systems.</p></div>
      <div class="three-columns about-pillars">{foundation_cards}</div>
      <div class="about-next"><p>We connect these perspectives through mathematics, computation, and observation, testing which mechanisms matter in each system.</p>{text_link('See how we work', '/approach/')}</div>
    </section>
    <section class="wrap section about-curators" aria-labelledby="curators-title">
      <div class="section-heading"><div><p class="eyebrow">Coordination &amp; content</p><h2 id="curators-title">The people<br><em>keeping us connected.</em></h2></div><p>Eva Gerrish and Alex Gerrish serve as BIOracle’s curators and administrators for coordination and content, helping keep our community organized and our ideas clear and accessible.</p></div>
      <div class="two-paths">
        <article class="path-panel glass"><span class="index">01 / Curator &amp; administrator</span><h3>Eva Gerrish</h3><p>Eva studies economics and finance at the University of New Mexico (UNM).</p></article>
        <article class="path-panel glass"><span class="index">02 / Curator &amp; administrator</span><h3>Alex Gerrish</h3><p>Alex studies mathematics and computer science at Pasadena City College in Pasadena, California.</p></article>
      </div>
      <p class="about-note">Their participation puts our academy’s philosophy into practice: students help shape the community as they learn within it.</p>
    </section>{contact_band()}'''
    write_page('about', 'About',
               'BIOracle connects entrepreneurship, academic research, and teaching through Darwinian evolution, self-organized criticality, and non-equilibrium statistical mechanics.',
               content, 'about')


def mission():
    content = page_intro(
        'BIOracle / Full mission statement',
        'An education for<br><em>the world ahead.</em>',
        'Our mission is to connect discovery, practical work, and education so that '
        'people can understand a changing world, act with sound judgment, and help shape what comes next.',
        text_link('About BIOracle', '/about/'),
    )
    content += '''<section class="wrap narrow mission-statement" aria-label="Full mission statement">
      <article>
        <h2>A world that will not wait.</h2>
        <p>The pace of change is dizzying. Artificial intelligence is forcing us to reconsider what it means to know something, to do useful work, and to prepare for a profession. We do not know exactly where this will lead. We are concerned that education can continue along familiar paths even as the world those paths were designed for changes underneath our feet.</p>
        <p>BIOracle brings a company, a research consortium, and an academy into one working community. Practical problems should challenge our research; research should inform what we build; and both should continually reshape what and how we teach. This is our response to uncertainty: stay close to the work, question our assumptions, and be willing to change course.</p>

        <h2>Students deserve an honest answer.</h2>
        <p>We worry about university students. They invest years of their lives, effort, money, and trust in their education. We do not want to “produce” graduates who have satisfied a set of requirements but lack the skills and knowledge to navigate today’s world, let alone the world of the near future.</p>
        <p>The consequences could be painful: graduates unable to find meaningful work, uncertain of their place, and bitter about life or an education they were told would prepare them for it. That is a possibility we take seriously. We would regard it as a failure of our responsibility to students, not simply a failure on their part to adapt.</p>
        <p>No academy can promise employment or predict every change. But we owe students candor about uncertainty and a serious, continuing effort to prepare them for it. Education should give people both practical capabilities and the intellectual independence to decide what kind of life and work they want to pursue.</p>

        <h2>An academy that keeps learning.</h2>
        <p>BIOracle Academy seeks to stay at the cutting edge of this challenge. That means combining durable foundations—mathematics, scientific reasoning, computation, and clear communication—with experience using and critically evaluating emerging tools. Students should learn to frame worthwhile questions, test claims, recognize the limits of AI-generated answers, and build work they can explain and defend.</p>
        <p>Our scientific foundations—Darwinian evolution, self-organized criticality, and non-equilibrium statistical mechanics—give us ways to investigate adaptation, instability, and change. Through research, mentorship, and entrepreneurial projects, we want students to put that understanding to work and develop the confidence to learn unfamiliar things.</p>

        <h2>A weekly conversation, with consequences.</h2>
        <p>We plan to hold weekly brainstorming meetings among faculty and students devoted to one question: how can we better prepare students for what is coming? We want to discuss changes in AI and the wider world, what students are encountering in their work, which abilities are becoming more valuable, and where our teaching may be falling behind.</p>
        <p>Students must be participants in shaping this response. We intend these meetings to lead to concrete experiments: revising a project, trying a new tool, strengthening a neglected foundation, or changing how we assess understanding. We will return to those experiments, ask what helped, and revise again. Staying current must be a shared practice, not a claim in a brochure.</p>

        <h2>Our responsibility.</h2>
        <p>We embrace entrepreneurial thinking while rejecting a for-profit model of education. Our purpose is to help people become capable, thoughtful, adaptable participants in the world. We want students to leave with knowledge they can use, judgment they can trust, and the ability to keep learning when the familiar answers stop working. The academy must hold itself to that same standard.</p>
      </article>
    </section>'''
    write_page('mission', 'Full mission statement',
               'BIOracle Academy’s commitment to preparing students for a rapidly changing world through research, practical experience, and weekly faculty–student discussions.',
               content, 'about')


def approach():
    content = page_intro('Our approach / Theory meets observation', 'Foresight starts<br><em>with understanding.</em>', 'A useful forecast connects a clear question with the mechanisms that drive change. It makes uncertainty visible and learns from new evidence.')
    steps = [('Frame the question.', 'Define the system, the decision, and the timescale. Identify the information that is available and the uncertainty that matters.'), ('Model the mechanisms.', 'Connect evolutionary processes with mathematical models. Use population genetics, probability, and computation to represent change.'), ('Map possible futures.', 'Explore alternative trajectories and show how assumptions affect the forecast. Compare scenarios rather than reducing the future to one outcome.'), ('Learn and reassess.', 'Compare predictions with observations. Update the analysis as the population, environment, or evidence changes.')]
    rows = ''.join(f'<div class="approach-step"><span class="index">{i:02}</span><h2>{title}</h2><p>{text}</p></div>' for i,(title,text) in enumerate(steps,1))
    content += f'<section class="wrap section approach-steps">{rows}</section><section class="section approach-section"><div class="wrap approach-grid"><div><p class="eyebrow">The horizon matters</p><h2>Uncertainty is<br><em>part of the answer.</em></h2><p class="body-copy">As the horizon grows, possible outcomes can diverge. A useful forecast makes that range understandable and keeps its assumptions in view.</p><p class="body-copy">Stochastic models and Bayesian inference describe chance and uncertainty. Simulation, network analysis, and time-series methods let us compare alternative conditions.</p></div>{forecast()}</div></section><section class="section wrap philosophy"><p class="eyebrow">Our philosophy</p><h2>Scientific rigor.<br>Entrepreneurial spirit.<br><em>Knowledge shared.</em></h2><div><p>BIOracle connects the private and public sectors. Our consortium brings together universities, businesses, and government partners around fundamental questions and practical applications.</p><p>We embrace apprenticeship, mentorship, and entrepreneurial thinking while rejecting for-profit education. Collaborative research trains the next generation of evolutionary theorists and creates room for independent inquiry.</p>{text_link("Meet our researchers", "/consortium/")}</div></section>{contact_band()}'
    write_page('approach', 'Our approach', 'Mathematics, computer science, and evolutionary biology connect mechanisms, observations, and possible futures.', content, 'approach')


def consortium():
    profiles = ''
    for person in DATA['faculty']:
        image = '/assets/' + person['image'].strip('/')
        profiles += f'<a class="person" href="/consortium/{person["slug"]}/"><div class="portrait"><img src="{image}" alt="{e(person["name"])}" width="400" height="480" loading="lazy"></div><div class="person-meta"><p class="small-label">{e(person["role"])}</p><h3>{e(person["name"])}</h3><p>{e(" · ".join(person["expertise"]))}</p><span class="person-arrow" aria-hidden="true">↗</span></div></a>'
        expertise = ''.join(f'<li>{e(x)}</li>' for x in person['expertise'])
        lead = 'Philip Gerrish leads the research programme at the intersection of evolutionary theory and probability. BIOracle connects this foundation with applied forecasting and an international research community.' if person['slug']=='phil-gerrish' else f'{person["name"]} contributes expertise in '+', '.join(person['expertise'])+'.'
        detail = page_intro('The consortium / '+person['role'], e(person['name']), ' · '.join(person['expertise']), text_link('All researchers', '/consortium/'))
        detail += f'<section class="wrap profile-layout"><div class="profile-photo"><img src="{image}" alt="{e(person["name"])}" width="500" height="600"></div><article><p class="eyebrow">Research perspective</p><p class="article-lead">{e(lead)}</p><h2>Areas of expertise.</h2><ul class="expertise-list">{expertise}</ul><p>Our consortium connects complementary disciplines through shared theory, computational work, mentorship, and collaborative research.</p>{button("Explore a collaboration", "/contact/?type=Research+collaboration")}</article></section>{contact_band()}'
        write_page('consortium/'+person['slug'], person['name'], 'Research in '+', '.join(person['expertise'])+'.', detail, 'consortium')
    content = page_intro('The consortium / People & ideas', 'Different expertise.<br><em>A shared curiosity.</em>', 'An international community of researchers connecting evolutionary theory, mathematics, computation, and the systems they help us understand.')
    content += f'<section class="wrap section team-section"><div class="section-line"><p class="eyebrow">Faculty & research collaborators</p><span class="small-label">Across disciplines. Across borders.</span></div><div class="people-grid">{profiles}</div></section><section class="section approach-section"><div class="wrap two-columns"><div><p class="eyebrow">The next generation</p><h2>Learn through<br><em>discovery.</em></h2></div><div><p class="article-lead">Apprenticeship and mentorship are central to how we work.</p><p>We welcome inquiries from graduate students, postdoctoral researchers, and collaborators interested in mathematical and probabilistic evolution. Bring a question, a complementary perspective, or an idea for joint research.</p>{text_link("Explore opportunities", "/contact/?type=Student+or+postdoctoral+inquiry")}</div></div></section>{contact_band()}'
    write_page('consortium', 'The consortium', 'Meet BIOracle’s international community of evolutionary researchers and mathematical scientists.', content, 'consortium')


def consulting():
    services = [
        ('Evolutionary risk assessment', 'Evaluate safeguard reliability, containment over time, and ecological or host interactions. Connect uncertainty with the evidence a decision needs.', ['Safeguard robustness and trait stability', 'Containment reliability and review windows', 'Spillover and interaction risks', 'Evidence for safety and oversight']),
        ('Custom modeling & forecasting', 'Develop mathematical and computational models for a defined biological, financial, or adaptive digital system.', ['Stochastic evolutionary models', 'Population dynamics and simulation', 'Mutation and selection analysis', 'Alternative scenarios and long-term stability']),
        ('Strategic consultation', 'Clarify a research direction, evaluate an approach, or connect evolutionary thinking with an organizational question.', ['Expert consultation and research strategy', 'Funding proposals and project design', 'Monitoring and evidence priorities', 'Planning for review and reassessment']),
        ('Focused preliminary assessment', 'A defined first look at a time-sensitive question, with priorities for deeper analysis and a clear account of the uncertainties.', ['Review of the available information', 'Executive summary of findings', 'Critical uncertainties and evidence gaps', 'Recommended next steps']),
    ]
    rows=''
    for i,(title,desc,items) in enumerate(services,1):
        rows+=f'<article class="service-row"><span class="index">{i:02}</span><div><h2>{title}</h2><p>{desc}</p>{text_link("Discuss this service", "/contact/?type="+title.replace(" ","+"))}</div><ul class="plain-list">'+''.join(f'<li>{s}</li>' for s in items)+'</ul></article>'
    partners=[('Universities','Joint research, collaborative grants, academic exchange, and mentorship.'),('Businesses','Applied research, consulting, custom software, and technology transfer.'),('Government','Public-interest research, funding programmes, preparedness, and policy advice.'),('Philanthropy','Research support and partnerships that advance shared scientific questions.')]
    partner_html=''.join(f'<div><h3>{a}</h3><p>{b}</p></div>' for a,b in partners)
    steps=''.join(f'<div><span class="index">{i:02}</span><h3>{title}</h3><p>{text}</p></div>' for i,(title,text) in enumerate([('Initial conversation','Discuss the system, the decision, and the available evidence.'),('Proposal & agreement','Define the approach, timeline, deliverables, and fees.'),('Research & analysis','Develop the work with regular communication and review.'),('Delivery & support','Interpret the findings and plan any continuing assessment.')],1))
    content=page_intro('The company / Working together','A clear question.<br><em>A useful next step.</em>','Evolutionary modeling, risk assessment, and strategic research for industry, government, and academic partners.',button('Discuss a project','/contact/?type=Consulting+inquiry'))
    content+=f'<section class="wrap section services">{rows}</section><section class="section approach-section"><div class="wrap"><p class="eyebrow">From inquiry to delivery</p><h2>A considered process.</h2><div class="four-columns process-grid">{steps}</div></div></section><section class="wrap section"><div class="section-heading"><div><p class="eyebrow">Partnerships</p><h2>Several ways<br>to work together.</h2></div><p>We connect rigorous scientific inquiry with real-world applications, working flexibly across the public and private sectors.</p></div><div class="four-columns">{partner_html}</div></section><section class="wrap section three-columns engagement-terms"><div><h3>Research & computational tools</h3><p>Custom software, data analysis pipelines, mathematical models, and collaborative research shaped around your question.</p></div><div><h3>Training & grant support</h3><p>Workshops, seminars, apprenticeship, project design, and support for joint funding proposals.</p></div><div><h3>Clear terms</h3><p>Scope, fees, milestones, invoicing, confidentiality, and intellectual property are agreed for each engagement. Ongoing partnerships can evolve with the work.</p></div></section>{contact_band()}'
    write_page('consulting','Consulting & partnerships','Research partnerships, evolutionary modeling, forecasting, and risk assessment with BIOracle.',content)


def publications():
    selected=[{'year':'2012','title':'Real time forecasting of near-future evolution','authors':'Philip J. Gerrish & Paul D. Sniegowski','journal':'Journal of the Royal Society Interface 9, 2268–2278','url':'https://pmc.ncbi.nlm.nih.gov/articles/PMC3405757/','topic':'Forecasting'}, {'year':'1998','title':'The fate of competing beneficial mutations in an asexual population','authors':'Philip J. Gerrish & Richard E. Lenski','journal':'Genetica 102–103, 127–144','url':'https://pubmed.ncbi.nlm.nih.gov/9720276/','topic':'Evolutionary theory'}]
    records=''
    for p in selected:
        records+=f'<article class="publication" data-publication data-year="{p["year"]}" data-search="{e(" ".join(p.values()).lower())}"><span class="publication-year">{p["year"]}</span><div><p class="small-label">{p["topic"]}</p><h2><a href="{p["url"]}" target="_blank" rel="noopener noreferrer">{e(p["title"])} {ARROW}</a></h2><p>{e(p["authors"])}</p><p class="publication-journal">{e(p["journal"])}</p></div></article>'
    content=page_intro('Publications / Selected foundations','Ideas that make<br><em>foresight possible.</em>','Selected work on evolutionary forecasting and the dynamics of adaptation, with links to the published records.')
    content+=f'<section class="wrap section publication-section"><div class="publication-toolbar"><label for="publication-search" class="sr-only">Search selected publications</label><input type="search" id="publication-search" placeholder="Search titles, authors, or topics"><label for="publication-year" class="sr-only">Filter publication year</label><select id="publication-year"><option value="all">All years</option><option value="2012">2012</option><option value="1998">1998</option></select><button type="button" class="text-button" id="publication-reset">Reset</button></div><p class="small-label" id="publication-count" role="status">2 publications</p>{records}<p id="publication-empty" class="empty-state" hidden>No matching publications. Try another term or reset the filters.</p></section><section class="wrap section two-columns archive-note"><div><p class="eyebrow">Continuity of the record</p><h2>From the<br>source websites.</h2></div><div><p>The original websites also contain draft bibliography and manuscript records. Those entries are preserved in the source archive, with their supplied details and status kept separate from the published work above.</p>{text_link("Browse the original bibliography", "/archive/#bibliography")}{text_link("Source references (password required)", "/archive/#bibliography")}</div></section>{contact_band()}'
    write_page('publications','Publications','Selected publications on evolutionary forecasting and adaptation, plus the preserved source-site bibliography.',content,'publications')


def contact():
    options=['General inquiry','Research collaboration','Consulting inquiry','Evolutionary risk assessment','Custom modeling & forecasting','Strategic consultation','Focused preliminary assessment','Adaptive AI project','Student or postdoctoral inquiry','Speaking engagement','Media request','Philanthropic partnership']
    form=f'''<form id="inquiry-form" class="inquiry-form"><div class="form-heading"><p class="eyebrow">Start a conversation</p><h2>Tell us what you have in mind.</h2></div><div class="form-two"><div class="form-field"><label for="name">Your name <span>(required)</span></label><input id="name" name="name" autocomplete="name" required maxlength="160"></div><div class="form-field"><label for="email">Email address <span>(required)</span></label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254"></div></div><div class="form-field"><label for="organization">Organization <span>(optional)</span></label><input id="organization" name="organization" autocomplete="organization" maxlength="200"></div><div class="form-field"><label for="type">I’m interested in</label><select id="type" name="type">{''.join(f'<option>{e(s)}</option>' for s in options)}</select></div><div class="form-field"><label for="timeline">Desired timeline <span>(optional)</span></label><select id="timeline" name="timeline"><option value="">Select a timeline</option><option>Urgent: 1–2 weeks</option><option>Standard: 1–2 months</option><option>Flexible: 2+ months</option></select></div><div class="form-field"><label for="message">Your question or project <span>(required)</span></label><textarea id="message" name="message" rows="5" required maxlength="10000" placeholder="The system, the question, and the future you need to understand…"></textarea></div><div class="form-actions"><button type="submit" class="button">Prepare email {ARROW}</button><button type="button" class="text-button" id="copy-inquiry">Copy inquiry</button></div><p class="form-note">Opens a draft in your email app for you to review and send. You can also copy your inquiry and email us directly.</p><p id="form-status" role="status" class="form-status" aria-live="polite"></p></form>'''
    content=page_intro('Contact / An open conversation','Let’s look<br><em>ahead, together.</em>','A research question, a practical challenge, or a new collaboration. We welcome a thoughtful conversation.')
    content+=f'<section class="wrap contact-layout"><div class="contact-details"><p class="eyebrow">Write to us</p><a class="contact-email" href="mailto:{EMAIL}">{EMAIL}</a><button type="button" class="copy-email text-button" data-copy="{EMAIL}">Copy email ↗</button><div class="contact-topics"><h3>What can we explore?</h3><p>Research collaborations<br>Consulting & custom modeling<br>University & industry partnerships<br>Graduate & postdoctoral opportunities<br>Speaking & scientific exchange</p></div><p class="small-label">BIOracle<br>Company & research consortium</p></div><div class="glass form-panel">{form}</div></section>'
    write_page('contact','Contact','Start a conversation with BIOracle about research, evolutionary forecasting, consulting, or collaboration.',content)


def archive():
    # Original archives remain intact. Draft records are clearly contextualized.
    profiles=[]
    for p in DATA['legacy_members']:
        profiles.append((p['id'],p))
    profiles.extend(DATA['legacy_lab_people'].items())
    profile_cards=''
    for slug,p in profiles:
        profile_cards+=f'<a class="archive-profile" href="/archive/people/{slug}/"><span class="small-label">Source record</span><h3>{e(p["name"])}</h3><p>{e(p["role"])}</p>{ARROW}</a>'
        education=''.join('<li>'+e(x if isinstance(x,str) else ' · '.join(x.values()))+'</li>' for x in p.get('education',[]))
        pubs=''.join('<li>'+e(x if isinstance(x,str) else ' · '.join(x.values()))+'</li>' for x in p.get('selectedPublications',[]))
        interests=''.join('<li>'+e(x)+'</li>' for x in p.get('researchInterests',[]))
        content=page_intro('Source archive / Unconfirmed profile',e(p['name']),p['role'],text_link('Return to archive','/archive/#profiles'))
        content+=f'<section class="wrap narrow article-section"><p class="archive-notice">This is an inherited source-site record. Membership, biography, affiliations, and publication details have not been confirmed as BIOracle information.</p><h2>Biography as supplied.</h2><p>{e(p.get("bio",""))}</p><h3>Areas of expertise</h3><p>{e(" · ".join(p.get("expertise",[])))}</p><h3>Education as supplied</h3><ul class="plain-list">{education}</ul><h3>Research interests</h3><ul class="plain-list">{interests}</ul><h3>Publication records as supplied</h3><ul class="plain-list">{pubs}</ul></section>'
        write_page('archive/people/'+slug,p['name']+' — source record','Unconfirmed profile preserved from an original website template.',content)
    publications=[]
    seen=set()
    for p in DATA['legacy_publications']:
        seen.add(p['title'].casefold())
        publications.append(p)
    for slug,p in profiles:
        for pub in p.get('selectedPublications',[]):
            if isinstance(pub,dict):
                title=pub['title']
                item=dict(pub)
            else:
                title=pub
                item={'title':title,'year':'','authors':p['name'],'journal':'As supplied in profile'}
            if title.casefold() not in seen:
                seen.add(title.casefold())
                publications.append(item)
    publication_cards = []
    for p in publications:
        doi = '<p class="micro-note">DOI as supplied: ' + e(p['doi']) + '</p>' if p.get('doi') else ''
        publication_cards.append(f'<article class="archive-publication"><span class="small-label">{e(p.get("year", "Source record"))}</span><h3>{e(p["title"])}</h3><p>{e(p.get("authors", ""))}</p><p>{e(p.get("journal", ""))} {e(p.get("volume", ""))} {e(p.get("pages", ""))}</p>{doi}</article>')
    pubs = ''.join(publication_cards)
    original_prices=''.join(f'<li><strong>{e(s["title"])}</strong> · {e(s["duration"])} · {e(s["price"])}</li>' for s in DATA['services'])
    content=page_intro('Source archive / Original material','The record,<br><em>kept together.</em>','The complete original website files and their inherited records are preserved here for reference.',text_link('Current consortium','/consortium/'))
    content+=f'<section class="wrap section"><div class="archive-notice"><p>These source files include template profiles, draft publication records, contact details, and example service terms. Their presence here does not confirm them as current BIOracle information. The main site uses the supplied named faculty and the direct contact from the existing website.</p></div><div class="archive-downloads"><a href="/assets/analytics-source.zip" download><span class="small-label">Original website / ZIP</span><h3>Evolutionary Risk Analytics</h3><p>Research, services, profiles, publications, and English, Spanish, and Portuguese source content.</p>{ARROW}</a><a href="/assets/lab-source.zip" download><span class="small-label">Original website / ZIP</span><h3>Evolutionary Processes Lab</h3><p>Research domains, collaborators, photographs, partnerships, and the complete original code.</p>{ARROW}</a></div><div class="archive-links">{text_link("Consolidated source records (.json)", "/assets/source-records.json")}{text_link("Original references (.bib)", "/assets/source-publications.bib")}</div></section><section id="bibliography" class="wrap section"><p class="eyebrow">Bibliography as supplied</p><h2>Original publication records.</h2><p class="body-copy">The following entries have not been verified as published research or as BIOracle publications. Titles, authors, and supplied identifiers are retained for review.</p><div class="archive-publications">{pubs}</div></section><section id="profiles" class="wrap section"><p class="eyebrow">Profiles as supplied</p><h2>Earlier profile records.</h2><p class="body-copy">These are unconfirmed entries from the original website templates. The repeated student and alumni lists are retained in the downloadable source files.</p><div class="archive-profiles">{profile_cards}</div></section><section class="wrap section narrow"><p class="eyebrow">Service examples as supplied</p><h2>Original scope & pricing.</h2><p>These inherited examples are preserved for review. Current scope, timing, fees, and engagement terms are agreed in a project proposal.</p><ul class="plain-list">{original_prices}</ul><p>Additional examples in the original translations: basic assessment, $5,000 USD; comprehensive analysis, $15,000 USD; ongoing partnership, custom pricing.</p></section>'
    write_page('archive','Source archive','The original website material and unconfirmed source records preserved for reference.',content)


def aliases():
    for source,target in [('team','consortium'),('members','consortium'),('collaborations','consortium'),('contractor','consulting')]:
        destination=DIST/source/'index.html'
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={BASE_PATH}/{target}/"><title>BIOracle</title><link rel="canonical" href="{URL}/{target}/"></head><body><p><a href="{BASE_PATH}/{target}/">Continue to {target}</a></p></body></html>')


home()
about()
mission()
write_page('business-model', 'Our business model',
           'A proposed funding model for prompt research delivery and graduate-student support.',
           render_business_model(), 'about')
write_page('contract', 'Contract',
           'Create an unsigned BIOracle contract draft, start from source documents, or fill your institution’s PDF form.',
           render_contract_page(), 'contract', scripts=('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', '/vendor/pdf-lib-1.17.1.min.js', '/pdf-reader.js', '/contract-core.js', '/contract-form.js', '/contract-import.js', '/contract-template.js', '/draft-sync.js', '/contract-autosave.js'))
research()
for item in DATA['research']:
    research_detail(item)
risk_research()
ai()
approach()
consortium()
consulting()
publications()
contact()
archive()
ARCHIVE.write(DATA)
# Remove obsolete public copies so direct download URLs cannot bypass the lock.
for name in ('analytics-source.zip', 'lab-source.zip', 'source-records.json', 'source-publications.bib'):
    (DIST / 'assets' / name).unlink(missing_ok=True)
aliases()
(DIST/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{URL}{p}</loc></url>' for p in PAGES if not p.startswith('/archive'))+'</urlset>')
(DIST/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: '+BASE_PATH+'/archive/\nSitemap: '+URL+'/sitemap.xml\n')
print(f'Built {len(PAGES)} pages, plus 4 compatibility routes.')
