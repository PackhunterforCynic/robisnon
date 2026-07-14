// ---------- Projects Choice ----------
let selectedProjectURL = "";

function chooseProject(url){
  selectedProjectURL = url;
  document.getElementById("choiceModal").style.display = "block";
}

function closeChoiceModal(){
  document.getElementById("choiceModal").style.display = "none";
}

document.getElementById("previewBtn").addEventListener("click", function(){
  document.getElementById("choiceModal").style.display = "none";
  openProject(selectedProjectURL);
});

document.getElementById("websiteBtn").addEventListener("click", function(){
  document.getElementById("choiceModal").style.display = "none";
  window.open(selectedProjectURL, "_blank");
});

// Project Modal
function openProject(url){
  document.getElementById("projectModal").style.display = "block";
  document.getElementById("projectFrame").src = url;
}
function closeProject(){
  document.getElementById("projectModal").style.display = "none";
  document.getElementById("projectFrame").src = "";
}

// Contact Form
const contactForm=document.getElementById("contactForm");
contactForm.addEventListener("submit", function(e){
  e.preventDefault();
  const contact={name:name.value,email:email.value,message:message.value,date:new Date().toLocaleString()};
  let messages=JSON.parse(localStorage.getItem("messages"))||[];
  messages.push(contact);
  localStorage.setItem("messages",JSON.stringify(messages));
  alert("Message Sent!");
  this.reset();
});

// Close modals on outside click
window.onclick=function(e){
  if(e.target==document.getElementById("projectModal")) closeProject();
  if(e.target==document.getElementById("choiceModal")) closeChoiceModal();
}

// ---------- Hero Slider ----------
const slides = document.querySelectorAll('.hero-slide');
let currentSlide = 0;
function nextSlide() {
  slides[currentSlide].classList.remove('active');
  currentSlide = (currentSlide + 1) % slides.length;
  slides[currentSlide].classList.add('active');
}
setInterval(nextSlide, 5000);

// ---------- Company Name Type + Jump + Fade ----------
const companyName = "R-Next Technologies";
const nameElement = document.getElementById("animatedName");
const speed = 150; 
const delayBetweenLetters = 100; 
const pauseBeforeRestart = 1000; 

function animateCompanyName() {
  nameElement.innerHTML = ""; 
  companyName.split("").forEach((char, i) => {
    const span = document.createElement("span");
    span.textContent = char;
    nameElement.appendChild(span);
    setTimeout(() => {
      span.style.animation = `jumpFade 0.6s forwards`;
    }, i * delayBetweenLetters);
  });
  const totalDuration = companyName.length * delayBetweenLetters + 600 + pauseBeforeRestart;
  setTimeout(animateCompanyName, totalDuration);
}

animateCompanyName();
