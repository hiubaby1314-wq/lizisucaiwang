const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === DATABASE SETUP ===
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS chars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, isNew INTEGER, cat TEXT, grad TEXT,
  files TEXT, img TEXT, imgs TEXT, fla TEXT
);
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY, password TEXT, role TEXT
);
`);

// === SEED DATA ===
const charCount = db.prepare('SELECT COUNT(*) as cnt FROM chars').get().cnt;
if (charCount === 0) {
  const seedChars = [
    {id:1,name:'蝴蝶女孩',isNew:1,cat:'现代都市',grad:'linear-gradient(160deg,#831843,#ec4899,#fbcfe8)',files:'["png","fla"]',img:'蝴蝶女孩.png',imgs:null,fla:'蝴蝶女孩.fla'},
    {id:2,name:'國民哥哥',isNew:1,cat:'现代都市',grad:'linear-gradient(160deg,#1e3a5f,#3b82f6,#bfdbfe)',files:'["png"]',img:'國民哥哥.png',imgs:null,fla:null},
    {id:3,name:'灰衣',isNew:1,cat:'现代都市',grad:'linear-gradient(160deg,#374151,#6b7280,#d1d5db)',files:'["png","fla"]',img:'灰衣.png',imgs:null,fla:'灰衣.fla'},
    {id:11,name:'紫髮愛心',isNew:1,cat:'表情包',grad:'linear-gradient(160deg,#7c3aed,#c084fc,#f9a8d4)',files:'["fla","gif","gif","png"]',img:'紫髮愛心正面.png',imgs:'["紫髮愛心正面.png","紫髮愛心側.gif","紫髮愛心正側.gif"]',fla:'紫髮愛心.fla'},
    {id:12,name:'國民哥哥表情',isNew:1,cat:'表情包',grad:'linear-gradient(160deg,#0f766e,#14b8a6,#99f6e4)',files:'["fla","gif"]',img:'國民哥哥表情.gif',imgs:'["國民哥哥表情.gif"]',fla:'國民哥哥表情.fla'},
    {id:13,name:'彩虹表情',isNew:1,cat:'表情包',grad:'linear-gradient(160deg,#f43f5e,#fb923c,#facc15,#4ade80,#38bdf8,#a78bfa)',files:'["fla","gif"]',img:'彩虹表情.gif',imgs:'["彩虹表情.gif"]',fla:'彩虹表情.fla'},
    {id:14,name:'綠茶男',isNew:1,cat:'表情包',grad:'linear-gradient(160deg,#166534,#4ade80,#bbf7d0)',files:'["fla","gif"]',img:'綠茶男.gif',imgs:'["綠茶男.gif"]',fla:'綠茶男.fla'},
    {id:15,name:'趣味男孩',isNew:1,cat:'表情包',grad:'linear-gradient(160deg,#ea580c,#fb923c,#fed7aa)',files:'["fla","gif","gif"]',img:'趣味男孩正.gif',imgs:'["趣味男孩正.gif","趣味男孩正側.gif"]',fla:'趣味男孩.fla'}
  ];
  const ins = db.prepare('INSERT INTO chars (id,name,isNew,cat,grad,files,img,imgs,fla) VALUES (@id,@name,@isNew,@cat,@grad,@files,@img,@imgs,@fla)');
  for (const c of seedChars) ins.run(c);
}

const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
if (userCount === 0) {
  const insU = db.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)');
  insU.run('admin','admin123','admin');
  insU.run('hiubaby','123456','user');
}

// === HELPER ===
function parseChar(row) {
  return {
    id: row.id,
    name: row.name,
    isNew: !!row.isNew,
    cat: row.cat,
    grad: row.grad,
    files: row.files ? JSON.parse(row.files) : [],
    img: row.img,
    imgs: row.imgs ? JSON.parse(row.imgs) : null,
    fla: row.fla
  };
}

// === API ROUTES ===
app.get('/api/chars', (req, res) => {
  const rows = db.prepare('SELECT * FROM chars').all();
  res.json(rows.map(parseChar));
});

app.post('/api/chars', (req, res) => {
  const { action, char, adminUser } = req.body;
  // verify admin
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUser);
  if (!user || user.role !== 'admin') return res.json({ ok: false, msg: '无管理员权限' });

  if (action === 'add') {
    const c = char;
    const r = db.prepare('INSERT INTO chars (name,isNew,cat,grad,files,img,imgs,fla) VALUES (?,?,?,?,?,?,?,?)').run(
      c.name, c.isNew ? 1 : 0, c.cat, c.grad,
      JSON.stringify(c.files || []), c.img || null,
      c.imgs ? JSON.stringify(c.imgs) : null, c.fla || null
    );
    return res.json({ ok: true, id: r.lastInsertRowid });
  }
  if (action === 'update') {
    const c = char;
    db.prepare('UPDATE chars SET name=?,isNew=?,cat=?,grad=?,files=?,img=?,imgs=?,fla=? WHERE id=?').run(
      c.name, c.isNew ? 1 : 0, c.cat, c.grad,
      JSON.stringify(c.files || []), c.img || null,
      c.imgs ? JSON.stringify(c.imgs) : null, c.fla || null, c.id
    );
    return res.json({ ok: true });
  }
  if (action === 'delete') {
    db.prepare('DELETE FROM chars WHERE id=?').run(char.id);
    return res.json({ ok: true });
  }
  res.json({ ok: false, msg: '未知操作' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, msg: '请输入用户名和密码' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.json({ ok: false, msg: '用户名不存在' });
  if (user.password !== password) return res.json({ ok: false, msg: '密码错误' });
  res.json({ ok: true, user: { username: user.username, role: user.role } });
});

app.get('/api/users', (req, res) => {
  const { adminUser } = req.query;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUser);
  if (!user || user.role !== 'admin') return res.json({ ok: false, msg: '无权限' });
  const users = db.prepare('SELECT username, role FROM users').all();
  res.json({ ok: true, users });
});

app.post('/api/users', (req, res) => {
  const { action, username, password, oldPassword, newPassword, adminUser } = req.body;

  if (action === 'add') {
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUser);
    if (!admin || admin.role !== 'admin') return res.json({ ok: false, msg: '无权限' });
    const exists = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (exists) return res.json({ ok: false, msg: '用户名已存在' });
    if (!username || username.length < 2) return res.json({ ok: false, msg: '用户名至少2个字符' });
    db.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)').run(username, '123456', 'user');
    return res.json({ ok: true });
  }
  if (action === 'delete') {
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUser);
    if (!admin || admin.role !== 'admin') return res.json({ ok: false, msg: '无权限' });
    db.prepare('DELETE FROM users WHERE username = ?').run(username);
    return res.json({ ok: true });
  }
  if (action === 'changepwd') {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.json({ ok: false, msg: '用户不存在' });
    if (user.password !== oldPassword) return res.json({ ok: false, msg: '当前密码错误' });
    if (!newPassword || newPassword.length < 4) return res.json({ ok: false, msg: '新密码至少4位' });
    db.prepare('UPDATE users SET password = ? WHERE username = ?').run(newPassword, username);
    return res.json({ ok: true });
  }
  res.json({ ok: false, msg: '未知操作' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
