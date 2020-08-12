
const login=document.querySelector(".buttonsubmit");
const userName=document.querySelector("#name");
const form=document.getElementById("#form");

addEventListener();

function addEventListener(){
    login.addEventListener("submit",loginWelcome);
}
function loginWelcome(e){
    const newUser=userName.value.trim();
    if(newUser != null){
        form.setAttribute("action","welcome.html");
    }else{
        alert("Please enter an username.");
    }
}
