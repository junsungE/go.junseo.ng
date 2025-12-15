const form = document.getElementById("createForm");
      const msg = document.getElementById("message");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.type = "external";

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        msg.textContent = 'Creating...';

        try {
          const res = await fetch("/api/createLink", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });

          let result = null;
          try {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              result = await res.json();
            } else {
              const text = await res.text();
              try { result = JSON.parse(text); } catch { result = { error: text || `HTTP ${res.status}` }; }
            }
          } catch (err) {
            result = { error: 'Invalid server response' };
          }

          if (res.ok) {
            const url = result && (result.fullUrl || result.url || result.slug) ? (result.fullUrl || result.url || result.slug) : 'created';
            msg.textContent = `Success! URL: ${url}`;
          } else {
            msg.textContent = `Error: ${result && result.error ? result.error : 'Server error'}`;
          }
        } catch (err) {
          msg.textContent = `Network error: ${err && err.message ? err.message : String(err)}`;
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });