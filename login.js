document.addEventListener('DOMContentLoaded',function(){
  const form = document.getElementById('loginForm');
  const btn = form.querySelector('.btn-primary');

  form.addEventListener('submit',function(e){
    e.preventDefault();
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = 'Signing in...';

    // small success animation then redirect back to shop
    setTimeout(()=>{
      btn.innerHTML = '✓ Signed in';
      btn.style.transform = 'scale(0.98)';
    },700);

    setTimeout(()=>{
      window.location.href = 'shop.html';
    },1400);
  });
});
