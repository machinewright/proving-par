# Renders og.png (1200x630): the title next to the ghost-light board with the seven forced mirrors ringed.
# Needs the local server: python3 -m http.server 8770 --bind 127.0.0.1 (from the repo root).
import asyncio, base64
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 700, 'height': 900}, device_scale_factor=2, reduced_motion='reduce')
        pg = await ctx.new_page()
        await pg.goto('http://127.0.0.1:8770/index.html'); await pg.wait_for_timeout(1200)
        w = (await pg.query_selector_all('.widget'))[4]
        await (await w.query_selector('text=Test every mirror')).click(); await pg.wait_for_timeout(200)
        png = await (await w.query_selector('canvas')).screenshot()
        card = await b.new_page(viewport={'width': 1200, 'height': 630})
        await card.set_content(f'''<body style="margin:0;width:1200px;height:630px;background:#12161f;display:flex;align-items:center;font-family:system-ui,sans-serif">
          <div style="flex:1;padding:0 50px 0 70px;color:#e6eaf0">
            <div style="font-size:64px;font-weight:700;line-height:1.08;letter-spacing:-1px">How do you know 7&nbsp;is the best?</div>
            <div style="font-size:27px;color:#a7afbd;margin-top:26px;line-height:1.35">An interactive essay on how a computer proves a puzzle can't be solved in fewer moves.</div>
          </div>
          <img src="data:image/png;base64,{base64.b64encode(png).decode()}" style="width:530px;height:530px;margin-right:50px;border-radius:10px">
        </body>''')
        await card.screenshot(path='og.png')
        await b.close()
asyncio.run(main())
