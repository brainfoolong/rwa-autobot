### Project discontinued
Because of lack of time, i must discontinue this project. It will stay online, it will probably work out of the box. Maybe someone can take over development for this project?! Feel free to fork it.

# Autobot Widget

The name is program. Automate commands, schedule commands, simply do "if this than that". You can also listen for an incoming server messages. You can do some periodic tasks like sending a server message out every 30 minutes or restart server each day at 06:00 am. You can do an auto-kick/auto-ban feature. We provide some templates to start with. Fully scriptable with, easy to use, all time best, javascript. It's basically a widget in a widget in the rcon web admin, magic, isn't it?
    
## Pre-defined variables

You can use this pre-defined variables in your script.

* context

    Defines in which context this script execution is currently in.  
    * ***update*** = Everytime the backend call the update procedure. Every 30 seconds.
    * ***serverMessage*** = A raw rcon message.
    
* message
    
    The raw string message from the server. Just use `log(message)` to see what you get.

## Pre-defined methods

You can use this methods to send a chat message or to execute any command you like.

* **cmd(cmd)** = Execute any rcon command
* **storage.set(key, value, lifetime)** = Set value in permanent storage, lifetime in seconds, ommit if no timeout
* **storage.get(key)** = Get value from permanent storage
* **variable.get(name)** = Get a value from a `variable.add`
* **variable.add(name, type, label, defaultValue)** 
    * Add a variable to the script interface. This could be used to allow the script define UI form elements where the user can enter the variable values. See templates for examples.
    * **name** = The name of the variable that than can be used in the script
    * **type** = The variable type, available types: switch, number, text
    * **defaultValue** = The default value of the variable if the user don't change it
    
## FAQ

* Every script will be executed each 30 seconds and also everytime a server message has been received. Keep script's simple.
* Script execution will terminate after 5 seconds. Don't use intervals or timeouts.
* Rust don't send a server message when the user a beginning slash in the chat. If you wish to add a user command feature, use a beginning hashtag, like `#nextwipe` example.
* Use `log()` for debugging. Open up the browser console (`F12`) when you write a script. Every `log()` call will show up in the browser console. Also any error will show up in the console as well.
