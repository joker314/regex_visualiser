const saveButton = document.querySelector("#save_regex")
const saveMessage = document.querySelector("#save_message")

const inputRegexBox = document.querySelector("#inputted_regex")
const testWordBox = document.querySelector("#test_word")

saveButton.addEventListener("click", () => {
	const saveRequest = new XMLHttpRequest()
	const regexID = +saveButton.dataset.regexId
	
	if (regexID === 0) {
		saveRequest.open("POST", "/api/regex/add")
		saveRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
		
		saveRequest.onreadystatechange = function () {
			if (saveRequest.readyState === 4) {
				if (saveRequest.status === 200) {
					const {id} = JSON.parse(saveRequest.responseText)
					saveMessage.textContent = "Saved successfully"
					saveButton.dataset.regexId = id
				} else {
					let errorMessage = "(malformed response from server)"
					
					try {
						errorMessage = JSON.parse(saveRequest.responseText).error
					} catch (error) {
						// The fallback errorMessage will be used, so we can ignore the error
						// since it's already been handled in that way
						console.error(error)
					}
					
					saveMessage.textContent = "Error while saving: " + errorMessage
				}
			}
		}
		
		saveRequest.send("regex=" + encodeURIComponent(inputRegexBox.value) + "&sample_input=" + encodeURIComponent(testWordBox.value))
	}
})