/* ==========================================================================
   Body Scent — shared script (product.html, order.html, admin.html)
   Each section runs only if the page contains its elements.
   ========================================================================== */
(function () {
  'use strict';

  var PRODUCTS_URL = 'products.json';
  var ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkMysIP-t-EQV-krq44p4uhbCw8zXh5rx97uVMwzqJzFm53Hsv7q8LnKKjiBA62l1z2OhT23osEE7b/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  var MOOD_LABELS = {
    fresh: 'Fresh',
    sweet: 'Sweet',
    confident: 'Confident',
    romance: 'Romance'
  };

  /* ---------- small helpers ---------- */

  // create an element; text goes through textContent so nothing is parsed as HTML
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ==========================================================================
     1) product.html — product cards + mood filter
     ========================================================================== */
  function initProducts() {
    var filterBar = document.getElementById('filter-bar');
    var list = document.getElementById('product-list');
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = 'all';

    function productLabel(p) {
      return p.size ? p.name + ' ' + p.size : p.name;
    }

    function orderUrl(p) {
      return (
        'order.html?item=' + encodeURIComponent(productLabel(p)) +
        '&price=' + encodeURIComponent(p.price)
      );
    }

    function buildCard(p) {
      var card = el('article', 'product-card');
      card.setAttribute('data-mood', p.mood);

      var media = el('div', 'product-card__media');
      var img = el('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      media.appendChild(img);

      var body = el('div', 'product-card__body');

      var tag = el('span', 'mood-tag');
      tag.appendChild(el('span', 'mood-dot'));
      tag.appendChild(el('span', null, MOOD_LABELS[p.mood] || p.mood));

      var name = el('h3', 'product-card__name', p.name);

      var foot = el('div', 'product-card__foot');
      foot.appendChild(
        el('span', 'product-card__meta', p.size ? p.size : p.type === 'rollon' ? 'โรลออน' : '')
      );
      var price = el('span', 'price', Number(p.price).toLocaleString('th-TH'));
      price.appendChild(el('small', null, 'บาท'));
      foot.appendChild(price);

      var buy = el('a', 'btn btn--block mt-3', 'สั่งซื้อ');
      buy.href = orderUrl(p);

      body.appendChild(tag);
      body.appendChild(name);
      body.appendChild(foot);
      body.appendChild(buy);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render() {
      list.textContent = '';
      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });
      if (!shown.length) {
        list.appendChild(el('p', 'muted', 'ยังไม่มีสินค้าในหมวดนี้'));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function setMood(mood) {
      currentMood = mood;
      Array.prototype.forEach.call(filterBar.querySelectorAll('.filter-chip'), function (btn) {
        var active = btn.getAttribute('data-mood') === mood;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      render();
    }

    function buildFilters() {
      filterBar.textContent = '';
      MOODS.forEach(function (m) {
        var btn = el('button', 'filter-chip', m.label);
        btn.type = 'button';
        btn.setAttribute('data-mood', m.key);
        btn.addEventListener('click', function () {
          setMood(m.key);
          // keep the URL in sync so the filtered view can be shared
          var url = new URL(window.location.href);
          if (m.key === 'all') url.searchParams.delete('mood');
          else url.searchParams.set('mood', m.key);
          window.history.replaceState(null, '', url);
        });
        filterBar.appendChild(btn);
      });
    }

    buildFilters();
    list.appendChild(el('p', 'muted', 'กำลังโหลดสินค้า...'));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        var wanted = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
        var valid = MOODS.some(function (m) {
          return m.key === wanted;
        });
        setMood(valid ? wanted : 'all');
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = '';
        list.appendChild(el('p', 'muted', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
      });
  }

  /* ==========================================================================
     2) order.html — prefill from URL + submit to Apps Script
     ========================================================================== */
  function initOrder() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    // เติม items และ total จาก URL parameter (item, price) ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');
    var itemsField = document.getElementById('items');
    var totalField = document.getElementById('total');
    if (item && itemsField) itemsField.value = item;
    if (price && totalField) totalField.value = price;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var payload = {
        customerName: document.getElementById('customerName').value,
        contact: document.getElementById('contact').value,
        items: document.getElementById('items').value,
        total: document.getElementById('total').value,
        note: document.getElementById('note').value
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch('https://script.google.com/macros/s/AKfycbwykg4sfnHdF61I5_yC5KGuzHJwTdGpJHOdVlWmlXIxgYLeZbN1EQyQ9EjEPNbDWmk1Dg/exec', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = 'thankyou.html'; })
        .catch(error => {
          console.error(error);
          if (submitBtn) submitBtn.disabled = false;
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    });
  }

  /* ==========================================================================
     3) admin.html — read the published CSV and show it as a table
     ========================================================================== */

  // CSV parser: handles quoted fields, commas and line breaks inside quotes,
  // escaped quotes (""), CRLF/LF line endings and a leading BOM.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function initAdmin() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLUMNS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

    function message(text) {
      tbody.textContent = '';
      var tr = el('tr');
      var td = el('td', 'muted', text);
      td.colSpan = COLUMNS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    message('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text)
          .slice(1) // แถวแรกคือหัวคอลัมน์
          .filter(function (r) {
            return r.some(function (cell) {
              return cell.trim() !== '';
            });
          })
          .reverse(); // รายการล่าสุดขึ้นก่อน

        if (!rows.length) {
          message('ยังไม่มีคำสั่งซื้อ');
          return;
        }

        tbody.textContent = '';
        rows.forEach(function (r) {
          var tr = el('tr');
          for (var i = 0; i < COLUMNS; i++) {
            tr.appendChild(el('td', null, r[i] !== undefined ? r[i] : ''));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        message('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ---------- boot ---------- */
  function init() {
    initProducts();
    initOrder();
    initAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
