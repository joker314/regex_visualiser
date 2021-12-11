const regexInputbox = document.getElementById("inputted_regex")
const regexOutput = document.getElementById("highlighted_regex")

regexInputBox.addEventListener("input", () => {
	regexOutput.textContent = regexInputbox.value;
})
